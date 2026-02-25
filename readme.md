# 🚀 Kubernetes Local Setup: ConfigMaps, Secrets & Volumes

> **Goal:** Build a Node.js app → Dockerize it → Push to Docker Hub → Deploy on local Kubernetes cluster (kind) → Test ConfigMaps, Secrets, and Volumes

---

## 📋 Prerequisites

Install the following tools before starting:

| Tool | Purpose | Install Link |
|------|---------|-------------|
| Docker Desktop | Container runtime | https://www.docker.com/products/docker-desktop |
| `kind` | Local Kubernetes cluster | https://kind.sigs.k8s.io/docs/user/quick-start/#installation |
| `kubectl` | Kubernetes CLI | https://kubernetes.io/docs/tasks/tools/ |
| Node.js (v20+) | Run Node app locally | https://nodejs.org |

### Verify installations
```bash
docker --version
kind --version
kubectl version --client
node --version
```

---

## 📁 Project Structure

```
k8s-local/
├── app/
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── k8s/
│   ├── kind-config.yml
│   ├── cm.yml
│   ├── secret.yml
│   ├── deployment.yml
│   ├── service.yml
│   └── volume-demo.yml
└── README.md
```

---

## 🧱 Phase 1 — Build the Node.js App

> **Why no ts-node?**
> `ts-node` executes TypeScript on the fly at runtime and is notorious for causing version conflicts, peer-dependency errors, and slower startup — especially inside Docker. The correct approach is to compile TypeScript to JavaScript **once** during `docker build` and then run the compiled output with plain `node`. The app never needs ts-node. If you want type checking locally, just run `npm run build` — that's it.

### Step 1.1 — Initialize the project

```bash
mkdir k8s-local && cd k8s-local
mkdir app && cd app
npm init -y
npm install express
npm install -D typescript @types/node @types/express
npx tsc --init
```

> ✅ No `ts-node` installed. TypeScript is only used to compile — `node` runs the output.

### Step 1.2 — Create `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Step 1.3 — Create `src/index.ts`

This app reads environment variables (injected via ConfigMap/Secrets) and displays them on a webpage:

```typescript
import express, { Request, Response } from 'express';

const app = express();
const port = 3000;

app.get('/', (req: Request, res: Response) => {
  const envVars = {
    // From ConfigMap
    DATABASE_URL:        process.env.DATABASE_URL        || 'NOT SET',
    CACHE_SIZE:          process.env.CACHE_SIZE          || 'NOT SET',
    PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL || 'NOT SET',
    MAX_CART_ITEMS:      process.env.MAX_CART_ITEMS      || 'NOT SET',
    SESSION_TIMEOUT:     process.env.SESSION_TIMEOUT     || 'NOT SET',
    // From Secret
    DB_USERNAME:         process.env.DB_USERNAME         || 'NOT SET',
    DB_PASSWORD:         process.env.DB_PASSWORD         || 'NOT SET',
  };

  res.send(`
    <html>
      <head><style>
        body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 2rem; }
        h1   { color: #00d4ff; }
        pre  { background: #16213e; padding: 1rem; border-radius: 8px; font-size: 1rem; }
      </style></head>
      <body>
        <h1>🚀 K8s Demo App</h1>
        <h2>Environment Variables (ConfigMap + Secrets)</h2>
        <pre>${JSON.stringify(envVars, null, 2)}</pre>
        <h2>Volume Check</h2>
        <p>Run <code>kubectl exec</code> to inspect <code>/data/hello.txt</code> for the volume demo.</p>
      </body>
    </html>
  `);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`✅ App listening at http://localhost:${port}`);
});
```

### Step 1.4 — Update `package.json` scripts

```json
{
  "name": "k8s-demo-app",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc -b",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

> 🚫 No `ts-node` dependency. No `dev` script. Build first, then run with `node`.

### Step 1.5 — Test locally (compile → run)

```bash
# Compile TypeScript to dist/
npm run build

# Run the compiled output with plain node
DATABASE_URL=postgres://localhost/test \
DB_USERNAME=admin \
DB_PASSWORD=secret \
npm start

# Visit http://localhost:3000
```

---

## 🐳 Phase 2 — Dockerize the App

The Dockerfile compiles TypeScript **inside** the build layer. The final image only ships compiled JS and production dependencies — no TypeScript compiler, no ts-node, minimal footprint.

### Step 2.1 — Create `app/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

# Step 1: Copy package files (leverages Docker layer cache)
COPY package*.json ./

# Step 2: Install all deps including devDeps (tsc needs them)
RUN npm install

# Step 3: Copy source
COPY . .

# Step 4: Compile TypeScript → dist/
RUN npm run build

# Step 5: Remove devDependencies to keep image lean
RUN npm prune --production

EXPOSE 3000

# Run compiled JS directly — no ts-node needed
CMD ["node", "dist/index.js"]
```

### Step 2.2 — Create `app/.dockerignore`

```
node_modules
dist
*.log
.env
```

### Step 2.3 — Build and test Docker image locally

```bash
# Build the image (replace YOUR_DOCKERHUB_USERNAME)
docker build -t YOUR_DOCKERHUB_USERNAME/k8s-demo-app:latest .

# Test it by passing env vars at runtime
docker run -p 3000:3000 \
  -e DATABASE_URL="postgres://localhost/mydb" \
  -e CACHE_SIZE="500" \
  -e DB_USERNAME="admin" \
  -e DB_PASSWORD="supersecret" \
  YOUR_DOCKERHUB_USERNAME/k8s-demo-app:latest

# Visit http://localhost:3000
```

### Step 2.4 — Push to Docker Hub

```bash
docker login
docker push YOUR_DOCKERHUB_USERNAME/k8s-demo-app:latest
```

> ✅ Your image is now on Docker Hub — just like `100xdevs/env-backend` in the reference doc!

---

## ☸️ Phase 3 — Set Up Local Kubernetes Cluster (kind)

### Step 3.1 — Create `k8s/kind-config.yml`

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30007
        hostPort: 30007
  - role: worker
    extraPortMappings:
      - containerPort: 30007
        hostPort: 30008
  - role: worker
```

### Step 3.2 — Create the cluster

```bash
cd k8s-local/k8s

kind create cluster --config kind-config.yml --name k8s-local
```

**✅ Actual output:**
```
Creating cluster "k8s-local" ...
 ✓ Ensuring node image (kindest/node:v1.35.0) 🖼
 ✓ Preparing nodes 📦 📦 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
 ✓ Joining worker nodes 🚜
Set kubectl context to "kind-k8s-local"
```

```bash
kubectl get nodes
```

**✅ Actual output:**
```
NAME                      STATUS   ROLES           AGE   VERSION
k8s-local-control-plane   Ready    control-plane   32s   v1.35.0
k8s-local-worker          Ready    <none>          22s   v1.35.0
k8s-local-worker2         Ready    <none>          22s   v1.35.0
```

```bash
kubectl cluster-info --context kind-k8s-local
```

**✅ Actual output:**
```
Kubernetes control plane is running at https://127.0.0.1:58886
CoreDNS is running at https://127.0.0.1:58886/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```

---

## 🗂️ Phase 4 — ConfigMaps

A ConfigMap stores **non-sensitive** configuration as key-value pairs. Pods consume them as environment variables, CLI arguments, or files mounted in a volume.

### Step 4.1 — Create `k8s/cm.yml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  database_url: "postgres://app-db:5432/shop"
  cache_size: "1000"
  payment_gateway_url: "https://payment-gateway.example.com"
  max_cart_items: "50"
  session_timeout: "3600"
```

### Step 4.2 — Apply and verify

```bash
kubectl apply -f cm.yml
```

```bash
kubectl get configmaps
```

**✅ Actual output:**
```
NAME               DATA   AGE
app-config         5      16s
kube-root-ca.crt   1      4m35s
```

```bash
kubectl describe configmap app-config
```

**✅ Actual output:**
```
Name:         app-config
Namespace:    default
Labels:       <none>
Annotations:  <none>

Data
====
cache_size:
----
1000
database_url:
----
postgres://app-db:5432/shop
max_cart_items:
----
50
payment_gateway_url:
----
https://payment-gateway.example.com
session_timeout:
----
3600

BinaryData
====
Events:  <none>
```

---

## 🔐 Phase 5 — Secrets

### Understanding Kubernetes Secret Types

Kubernetes has **built-in secret types** — each designed for a specific purpose. The `type` field tells Kubernetes how to validate and handle the secret's data fields.

| Type | When to use |
|------|------------|
| `Opaque` | **Default / general-purpose.** Use for any arbitrary key-value data — DB passwords, API keys, tokens, JWT secrets. Kubernetes applies no validation; you can store anything. |
| `kubernetes.io/service-account-token` | Auto-created by Kubernetes for ServiceAccounts. Contains a JWT the pod uses to talk to the API server. Rarely created manually. |
| `kubernetes.io/dockerconfigjson` | Docker registry credentials for pulling private images. Created via `kubectl create secret docker-registry`. |
| `kubernetes.io/dockercfg` | Legacy `.dockercfg` format. Prefer `dockerconfigjson` for new setups. |
| `kubernetes.io/basic-auth` | HTTP Basic Auth. Must contain `username` and `password` keys — Kubernetes validates them. |
| `kubernetes.io/ssh-auth` | SSH private key. Must contain `ssh-privatekey`. Used for Git-over-SSH workflows. |
| `kubernetes.io/tls` | TLS certificate + private key. Must contain `tls.crt` and `tls.key`. Used by Ingress controllers to serve HTTPS. |
| `bootstrap.kubernetes.io/token` | Bootstrap tokens for new node join flow. Almost never created manually. |

> **Quick reference for most apps:**
> - App passwords / API keys → `Opaque`
> - Private Docker registry → `kubernetes.io/dockerconfigjson`
> - HTTPS certificates (Ingress) → `kubernetes.io/tls`

### Step 5.1 — Encode your secret values

```bash
# Always use -n to strip the trailing newline before encoding
echo -n 'admin' | base64
# → YWRtaW4=

echo -n 'supersecret123' | base64
# → c3VwZXJzZWNyZXQxMjM=
```

> ⚠️ **Always use `-n`** with `echo`. Without it the newline character gets encoded into the value and your secret will silently not match at runtime.

### Step 5.2 — Create `k8s/secret.yml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: default
type: Opaque          # general-purpose — arbitrary key-value secrets
data:
  db_username: YWRtaW4=              # base64 of 'admin'
  db_password: c3VwZXJzZWNyZXQxMjM=  # base64 of 'supersecret123'
```

### Step 5.3 — Apply and verify

```bash
kubectl apply -f secret.yml

kubectl get secrets
# NAME         TYPE     DATA   AGE
# app-secret   Opaque   2      5s

kubectl describe secret app-secret
# Data keys are shown, values are intentionally hidden
```

### Step 5.4 — Decode a secret value (for debugging)

```bash
kubectl get secret app-secret -o jsonpath='{.data.db_password}' | base64 --decode
# Output: supersecret123
```

> ⚠️ **Base64 is encoding, not encryption.** Anyone with `kubectl get secret` access can decode the value instantly. Protect secrets using Kubernetes RBAC. For production workloads use [HashiCorp Vault](https://www.vaultproject.io/), [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/), or enable [Kubernetes encryption at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/).

---

## 🚀 Phase 6 — Deployment (ConfigMap + Secret as Env Vars)

### Step 6.1 — Create `k8s/deployment.yml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: k8s-demo-app
  template:
    metadata:
      labels:
        app: k8s-demo-app
    spec:
      containers:
        - name: k8s-demo-app
          image: YOUR_DOCKERHUB_USERNAME/k8s-demo-app:latest
          ports:
            - containerPort: 3000
          env:
            # ── From ConfigMap ──────────────────────────────────────────
            - name: DATABASE_URL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: database_url
            - name: CACHE_SIZE
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: cache_size
            - name: PAYMENT_GATEWAY_URL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: payment_gateway_url
            - name: MAX_CART_ITEMS
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: max_cart_items
            - name: SESSION_TIMEOUT
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: session_timeout
            # ── From Secret ─────────────────────────────────────────────
            - name: DB_USERNAME
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: db_username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: db_password
```

> ⚠️ Replace `YOUR_DOCKERHUB_USERNAME` with your actual Docker Hub username.

### Step 6.2 — Create `k8s/service.yml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: app-service
  namespace: default
spec:
  type: NodePort
  selector:
    app: k8s-demo-app
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
      nodePort: 30007
```

### Step 6.3 — Apply and check status

```bash
kubectl apply -f deployment.yml
kubectl apply -f service.yml

kubectl get deployments
kubectl get pods
kubectl get services
```

### Step 6.4 — Access the App

```bash
# kind maps containerPort 30007 → hostPort 30007 via kind-config
open http://localhost:30007
# or
curl http://localhost:30007
```

All env vars from ConfigMap and Secrets should appear on the page. 🎉

---

## 💾 Phase 7 — Volumes (Ephemeral — emptyDir)

Two containers in the **same Pod** share data through an ephemeral volume. When the pod dies, the volume and its contents are gone with it.

### Step 7.1 — Create `k8s/volume-demo.yml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shared-volume-deployment
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shared-volume-app
  template:
    metadata:
      labels:
        app: shared-volume-app
    spec:
      containers:
        # Container 1: Writer — appends to the shared volume every 10s
        - name: writer
          image: busybox
          command:
            - "/bin/sh"
            - "-c"
            - |
              echo "Hello from Writer! Started: $(date)" > /data/hello.txt
              while true; do
                echo "Updated: $(date)" >> /data/hello.txt
                sleep 10
              done
          volumeMounts:
            - name: shared-data
              mountPath: /data

        # Container 2: Reader — reads the same file every 5s
        - name: reader
          image: busybox
          command:
            - "/bin/sh"
            - "-c"
            - |
              while true; do
                echo "=== Reader sees ===" && cat /data/hello.txt
                sleep 5
              done
          volumeMounts:
            - name: shared-data
              mountPath: /data

      volumes:
        - name: shared-data
          emptyDir: {}    # lives only as long as the pod lives
```

### Step 7.2 — Apply and verify

```bash
kubectl apply -f volume-demo.yml

# Get the pod name
kubectl get pods

# Stream reader logs to see shared data in real time
kubectl logs -f <pod-name> -c reader

# Exec into reader and inspect the file directly
kubectl exec -it <pod-name> -c reader -- /bin/sh
cat /data/hello.txt
exit
```

> ✅ Both containers share `/data`. Delete and reapply the deployment — the file is gone, proving ephemeral behavior.

---

## 🔄 Phase 8 — Updating ConfigMaps & Secrets (seeing changes on localhost)

This is one of the most important things to understand. **Kubernetes does NOT automatically reload env vars inside running pods when you change a ConfigMap or Secret.** Here is the complete mental model and the exact steps to follow.

### Why pods don't pick up changes automatically

When a pod starts, Kubernetes injects ConfigMap/Secret values into the pod's environment **once at startup**. After that the pod holds its own copy of those values in memory. Updating the ConfigMap or Secret in etcd does **not** reach inside an already-running pod — it has to be recreated to get a fresh injection.

```
ConfigMap/Secret updated in etcd
         │
         │  ← running pod does NOT see this change
         ▼
   Pod restarts (new pod created)
         │
         ▼
   Fresh env vars injected ✅
```

> **One exception:** if you mount a ConfigMap as a **file volume** (not as env vars), Kubernetes does sync the file inside the running pod automatically after ~60 seconds. But env-var-based injection always requires a pod restart.

---

### Case 1 — Updating a ConfigMap

#### Step 1 — Edit `cm.yml` and re-apply

Change any value in `k8s/cm.yml`, for example bump `cache_size` from `1000` to `2000`:

```yaml
data:
  cache_size: "2000"     # ← changed
  database_url: "postgres://app-db:5432/shop"
  # ... rest unchanged
```

Then push the change to the cluster:

```bash
kubectl apply -f cm.yml
```

Confirm the new value landed:

```bash
kubectl describe configmap app-config
# Under Data you should see:
# cache_size:
# ----
# 2000
```

#### Step 2 — Rolling restart the deployment

```bash
kubectl rollout restart deployment/app-deployment
```

This is a **rolling restart** — Kubernetes spins up new pods with the updated env vars, waits for them to become Ready, then terminates the old pods. Your app has zero downtime during this.

#### Step 3 — Watch pods cycle

```bash
kubectl get pods -w
```

Expected output while the rolling restart is in progress:
```
NAME                              READY   STATUS              RESTARTS
app-deployment-6d9f7b8c4-xk2p9   1/1     Running             0
app-deployment-6d9f7b8c4-xk2p9   1/1     Terminating         0
app-deployment-7c4b9d5f1-mn3q8   0/1     ContainerCreating   0
app-deployment-7c4b9d5f1-mn3q8   1/1     Running             0
```

Press `Ctrl+C` once all new pods show `Running`.

#### Step 4 — See the change on localhost

```bash
open http://localhost:30007
# CACHE_SIZE should now show 2000
```

Or verify inside the pod directly:

```bash
kubectl get pods                    # grab the new pod name
kubectl exec -it <new-pod-name> -- /bin/sh
env | grep CACHE_SIZE               # → CACHE_SIZE=2000
exit
```

---

### Case 2 — Updating a Secret

Secrets behave identically to ConfigMaps for env-var injection — the pod must restart to pick up changes. The only extra step is re-encoding the new value to base64 first.

#### Step 1 — Encode the new value

```bash
# Always use -n to avoid encoding a stray newline
echo -n 'newpassword456' | base64
# → bmV3cGFzc3dvcmQ0NTY=
```

#### Step 2 — Edit `secret.yml` with the new base64 value

```yaml
data:
  db_username: YWRtaW4=
  db_password: bmV3cGFzc3dvcmQ0NTY=   # ← updated
```

#### Step 3 — Re-apply the Secret

```bash
kubectl apply -f secret.yml
```

```bash
kubectl describe secret app-secret
# Should say "secret/app-secret configured" and show 2 data keys
```

#### Step 4 — Rolling restart and verify

```bash
kubectl rollout restart deployment/app-deployment
kubectl get pods -w

# Once new pods are Running:
open http://localhost:30007
# DB_PASSWORD should now show: newpassword456
```

---

### Case 3 — Updating both ConfigMap and Secret at once

If you are changing multiple things, batch all the applies and do a single restart:

```bash
# 1. Push all changes
kubectl apply -f cm.yml
kubectl apply -f secret.yml

# 2. One rolling restart picks up everything
kubectl rollout restart deployment/app-deployment

# 3. Wait for rollout to finish
kubectl rollout status deployment/app-deployment
```

Expected final output from `rollout status`:
```
Waiting for deployment "app-deployment" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "app-deployment" rollout to finish: 1 old replicas are pending termination...
deployment "app-deployment" successfully rolled out
```

---

### Quick inline edit (no YAML files needed)

For a fast one-off change without touching files, use `kubectl edit`. It opens the live resource in your terminal editor (`vim` by default — or export `KUBE_EDITOR=nano` to use nano):

```bash
# Edit ConfigMap live
KUBE_EDITOR=nano kubectl edit configmap app-config
# Change the value, save and exit

# Edit Secret live (remember values are still base64 here)
KUBE_EDITOR=nano kubectl edit secret app-secret

# Then restart to apply
kubectl rollout restart deployment/app-deployment
```

---

### Rollback if something goes wrong

If you apply a bad ConfigMap or Secret and the new pods crash (wrong DB URL, malformed value, etc.):

```bash
# Check rollout history
kubectl rollout history deployment/app-deployment

# Undo the last rollout — reverts pod spec to previous revision
kubectl rollout undo deployment/app-deployment

# Watch pods recover
kubectl get pods -w
```

> ⚠️ `rollout undo` reverts the **pod spec** (image, env refs) to the previous state but does **not** revert the ConfigMap or Secret stored in etcd. You need to manually restore the old YAML values and re-run `kubectl apply` to fully revert the config data.

---

### Complete update flow — reference diagram

```
1. Edit cm.yml or secret.yml locally
           │
           ▼
2. kubectl apply -f <file>
   → change saved to etcd, running pods unaffected
           │
           ▼
3. kubectl rollout restart deployment/app-deployment
   → old pods: Terminating
   → new pods: ContainerCreating → Running (env vars injected fresh)
           │
           ▼
4. kubectl rollout status deployment/app-deployment
   → "successfully rolled out"
           │
           ▼
5. open http://localhost:30007
   → new values visible in browser ✅
```

---

## 🔍 Phase 9 — Verification Cheatsheet

### Verify ConfigMap env vars inside a pod

```bash
kubectl exec -it <app-pod-name> -- /bin/sh
env | grep -E "DATABASE|CACHE|PAYMENT|CART|SESSION"
exit
```

### Verify Secret env vars inside a pod

```bash
kubectl exec -it <app-pod-name> -- /bin/sh
echo $DB_USERNAME   # → admin
echo $DB_PASSWORD   # → supersecret123
exit
```

### Update ConfigMap and rolling restart

```bash
kubectl edit configmap app-config
kubectl rollout restart deployment/app-deployment
kubectl get pods -w
```

### Inspect all resources at a glance

```bash
kubectl get configmaps,secrets,deployments,pods,services
```

---

## 🧹 Phase 10 — Cleanup

```bash
kubectl delete -f deployment.yml
kubectl delete -f service.yml
kubectl delete -f cm.yml
kubectl delete -f secret.yml
kubectl delete -f volume-demo.yml

kind delete cluster --name k8s-local
```

---

## 📊 Summary Table

| Concept | What it does | Where data lives | Survives pod death? |
|---------|-------------|-----------------|---------------------|
| **ConfigMap** | Non-sensitive config as env vars / files | etcd | ✅ Yes |
| **Secret — Opaque** | Arbitrary sensitive data (passwords, tokens) | etcd | ✅ Yes |
| **Secret — tls** | TLS cert + key for Ingress HTTPS | etcd | ✅ Yes |
| **Secret — dockerconfigjson** | Private registry pull credentials | etcd | ✅ Yes |
| **emptyDir Volume** | Shared scratch space between containers in a pod | Node disk/RAM | ❌ No |
| **PersistentVolume** | Long-lived storage (NFS, cloud block) | External | ✅ Yes |

---

## 💡 Key Takeaways

1. **Never use `ts-node` in production Docker images** — compile TS once with `tsc` during `docker build`, run the output with plain `node`
2. **Never bake secrets into your Docker image** — always inject them at runtime via Kubernetes Secrets
3. **`Opaque`** is the default Secret type for any app credential; use `kubernetes.io/tls` for HTTPS certs and `kubernetes.io/dockerconfigjson` for private registries
4. **Base64 is encoding, not encryption** — real security comes from Kubernetes RBAC controlling who can read secrets
5. **emptyDir** is perfect for sidecar containers sharing temp data; use PersistentVolumes for anything that must outlive a pod restart

---

*Reference: Kubernetes Part 2 — DailyCode / 100xDevs*
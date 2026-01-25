# Deploying .NET Web App and Angular to Azure Kubernetes Service (AKS) with Terraform & GitHub Actions

This project demonstrates how to deploy a .NET Web API application (backend) and an Angular client (frontend) to Azure Kubernetes Service (AKS) using Terraform for infrastructure provisioning and GitHub Actions for CI/CD, providing an end-to-end example setup.

**Note on Kubernetes Deployment:** This project uses raw Kubernetes YAML manifests for deployment. For a more advanced and scalable approach using **Helm**, please refer to the following repository https://github.com/kaajoj/iac-azure-dotnet-api-angular-aks-helm

## Project Structure

```
.
├── infra/              # Terraform code & Kubernetes manifests
│   └── k8s/
├── src/MyWebApp/       # .NET Web API project
├── src/my-web-ui/      # Angular UI project
└── .github/workflows/  # CI/CD workflows
    ├── infra.yml
    ├── deploy.yml
    └── destroy.yml
```

## Infrastructure/Services overview (via Terraform)

The following Azure services are provisioned:

- **Resource Group**
- **Azure Kubernetes Service (AKS)**: Manages containerized applications for both the .NET backend and Angular frontend.
- **Azure Container Registry (ACR)**: Stores Docker images for both .NET backend and Angular frontend.
- **Key Vault** (stores SQL connection string, identity-based access)
- **SQL Server & Database**
- **Application Insights** (with Log Analytics)
- **Log Analytics Workspace**

## GitHub Actions CI/CD

### `.github/workflows/infra.yml`

- Deploys all infrastructure using Terraform

### `.github/workflows/deploy.yml`

- Builds Docker images for both the .NET app and Angular UI
- Pushes Docker images to Azure Container Registry (ACR)
- Deploys container images to Azure Kubernetes Service (AKS) using Kubernetes manifests (`k8s/*.yaml`)

## Requirements

- Azure Subscription
- GitHub Secrets:

  - `AZURE_CREDENTIALS`: JSON generated via:

    ```bash
    az ad sp create-for-rbac --name "github-deploy" --role Owner --scopes /subscriptions/<your-subscription-id> --sdk-auth
    ```

    > **Note:** The `Owner` role is required because the Terraform script needs to create a role assignment (`AcrPull` role) to allow the AKS cluster to pull images from the Azure Container Registry. The `Contributor` role does not have sufficient permissions for this action.

  - `TF_VAR_subscription_id`: your Azure subscription ID

    Example: `12345678-abcd-1234-ef00-0123456789ab`

  - `TF_VAR_sql_admin_login`: login for SQL Server admin user

    Example: `sqladminuser`

  - `TF_VAR_sql_admin_password`: password for SQL Server admin user

    Example: `MySecureP@ssw0rd!`

  - `TF_VAR_connection_string`: full connection string stored in Key Vault

    Example:

    ```
    Server=tcp:dotnetappazuredeploy-sqlsrv.database.windows.net,1433;
    Initial Catalog=dotnetappazuredeploy-db;
    Persist Security Info=False;
    User ID=sqladminuser;
    Password=MySecureP@ssw0rd!;
    MultipleActiveResultSets=False;
    Encrypt=True;
    TrustServerCertificate=False;
    Connection Timeout=30;
    ```

> These secrets are automatically passed as Terraform variables or used in workflows during execution in GitHub Actions.

## Usage

1. **Clone the repository**.
2. **Set up GitHub Secrets**:

   In your repository, go to:

   `Settings → Secrets and variables → Actions → New repository secret`

   Add the following secrets:

   - `AZURE_CREDENTIALS` using `az ad sp create-for-rbac` as described above
   - `TF_VAR_subscription_id`
   - `TF_VAR_sql_admin_login`
   - `TF_VAR_sql_admin_password`
   - `TF_VAR_connection_string`

3. **Trigger workflows manually** via the **Actions** tab on GitHub:

   - `infra.yml` - provisions infrastructure
   - `deploy.yml` - builds and deploys the application

4. Once deployed, applications (both .NET backend and Angular UI) will be running as containers in Azure Kubernetes Service (AKS). GitHub Actions builds the containers, pushes them to ACR, and AKS pulls the latest images from ACR. To find the external IP address for the UI, run the following `kubectl` command. It may take a few minutes for the IP address to become available.

   ```bash
   kubectl get svc angular-app --watch
   ```

   (Alternatively, find the external IP in the Azure portal under `dotnetappazuredeploy-aks` -> `Services and ingresses` -> `Kubernetes service` for `angular-app` or `mywebapp-service`.)

   Once the `EXTERNAL-IP` changes from `<pending>` to an actual IP address, you can access the application in your browser.

- **Angular UI**:
  - `http://<angular-app-external-ip>`
- **.NET Backend API**: (Note: These endpoints are publicly accessible when `mywebapp-service` is `LoadBalancer`. If you change it to `ClusterIP` for enhanced security, they will only be accessible via the Angular UI proxy.)
  - `http://<mywebapp-service-external-ip>`
  - `http://<mywebapp-service-external-ip>/hello`
  - `http://<mywebapp-service-external-ip>/swagger/index.html` (swagger)
  - `http://<mywebapp-service-external-ip>/api/customers` (Example endpoint)

5. Push to **main** branch to automatically trigger deployment via GitHub Actions (`deploy.yml`), which will update the applications in AKS.

## Secrets Management: Key Vault and Secrets Store CSI

In this project, secrets like the database connection string are managed using Azure Key Vault. The current implementation fetches the secret during the CI/CD pipeline (`deploy.yml`) and creates a Kubernetes Secret directly. While straightforward, a more secure and production-ready approach is to use the **Secrets Store CSI driver for Kubernetes**.

### Current Approach: Kubernetes Secret via CI/CD

- **How it works**: The `deploy.yml` workflow retrieves the connection string from Azure Key Vault and uses a `kubectl create secret` command (or similar declarative method in a real scenario) to store it as a native Kubernetes Secret. The application pod then mounts this secret.
- **Pros**: Simple to set up and debug, making it suitable for quick deployments and testing environments.
- **Cons**: The secret's value is stored as a base64-encoded object within Kubernetes, and it does not automatically rotate if the source secret in Key Vault is updated.

### Recommended Approach: Secrets Store CSI Driver

For production environments, integrating the **Secrets Store CSI driver** is highly recommended due to its enhanced security and manageability.

- **How it works**: The CSI driver fetches secrets directly from Key Vault and mounts them into application pods, optionally syncing them with native Kubernetes Secrets.
- **Key Benefits**:
  - **Enhanced Security**: Secrets are not persistently stored in Kubernetes, reducing exposure.
  - **Dynamic Rotation**: Automatically updates secrets in pods when changes occur in Key Vault.
  - **Centralized Management**: Leverages Key Vault as the single source of truth for secrets.

In summary, while the current CI-based secret injection is simpler, adopting the **Secrets Store CSI driver** provides a more secure, scalable, and manageable solution for handling secrets in a production-grade Kubernetes environment.

## Scalability and Communication Configuration

### Scalability

Scalability in this project is managed at two levels: the cluster level (Azure infrastructure) and the application level (within AKS).

#### 1. Cluster Scaling (Manual)

- **Where:** Configured in the `infra/main.tf` file within the `azurerm_kubernetes_cluster` block.
- **How it works:** Currently, the cluster is configured with a fixed number of **one node** (`node_count = 1`). Autoscaling is not enabled.
- **How to scale:** To increase or decrease the number of machines in the cluster, you must manually modify the `infra/main.tf` file and change the `node_count` value, or add the `default_node_pool` configuration with `enable_auto_scaling = true`, `min_count`, and `max_count` parameters. These changes are managed at the Azure infrastructure level.

```terraform
# infra/main.tf
resource "azurerm_kubernetes_cluster" "aks" {
  # ...
  default_node_pool {
    name       = "default"
    node_count = 1 # Fixed number of nodes
    vm_size    = "Standard_B2s"
  }
  # ...
}
```

#### 2. Application Scaling (Manual)

- **Where:** Configured in the `deployment.yaml` files within the `infra/k8s/` directory.
- **How it works:** The number of pods (containers) for each application is set statically using the `replicas` parameter.
  - **Backend (.NET):** `replicas: 2` in `infra/k8s/deployment.yaml`.
  - **Frontend (Angular):** `replicas: 1` in `infra/k8s/angular-deployment.yaml`.
- **How to scale:** To manually scale an application, you must change the `replicas` value in the corresponding `deployment.yaml` file and deploy the changes to the cluster. To enable **automatic pod scaling**, you would need to create a `HorizontalPodAutoscaler` (HPA) resource in Kubernetes, which could dynamically adjust the number of replicas based on CPU or memory usage.

### Frontend-Backend Communication within Kubernetes

Communication between the client application (Angular) and the server (.NET) occurs entirely within the AKS cluster, using Nginx as a reverse proxy.

- **Where:** Configured in the `src/my-web-ui/nginx.conf` file for the proxying, and Kubernetes `Service` definitions (`infra/k8s/*.yaml`) for exposing applications.
- **Service Types:** Both the frontend (`angular-app`) and backend (`mywebapp-service`) Kubernetes Services are defined with `type: LoadBalancer`. This means that Azure provisions a dedicated public Load Balancer for _each_ service, providing them with external IP addresses.
- **Recommendation for Backend Security:** For production environments, it is highly recommended to change the backend service (`mywebapp-service`) from `type: LoadBalancer` to `type: ClusterIP`. This will prevent direct public internet access to the backend, forcing all external traffic to go through the frontend/API gateway (Angular UI). If you make this change, the backend API will not be exposed publicly and will only be accessible through the Angular UI.
- **How it works:**
  1. The user connects to the public IP address provided by the Azure Load Balancer associated with the `angular-app` service.
  2. The request hits the Nginx container within the frontend pod, which serves the static files of the Angular application.
  3. The Angular app sends API requests to a relative path, e.g., `/api/customers` (defined in `src/my-web-ui/src/environments/environment.prod.ts`).
  4. Nginx intercepts requests directed to the `/api/` path and, according to its configuration, proxies them to the internal Kubernetes service named `mywebapp-service`.
  5. Kubernetes DNS resolves the `mywebapp-service` name to the backend service's cluster IP, which then load-balances the request to one of the available .NET application pods.

The following snippet from `nginx.conf` handles this redirection:

```nginx
# src/my-web-ui/nginx.conf
location /api/ {
  # Forward the request to the in-cluster backend service
  proxy_pass http://mywebapp-service;
  # ... (additional headers)
}
```

This setup leverages the internal Kubernetes service discovery and Nginx proxying to manage API calls, while Azure Load Balancers handle external exposure of both the frontend and, implicitly, the backend (though the backend's public IP is not directly used by the frontend in this configuration due to the Nginx proxy).

## Troubleshooting & Known Issues

### Terraform State File

The `destroy.yml` workflow includes a note about the Terraform state file. By default, the state is stored locally on the GitHub Actions runner, which is not persistent. It is highly recommended to configure a remote backend (e.g., Azure Storage Account) to store the Terraform state file. This will ensure that the state is preserved between runs and that `terraform destroy` works as expected.

### Purging deleted Key Vault secrets (after terraform destroy)

If you destroy infrastructure and get an error like:

> A resource with the ID ".../secrets/ConnectionStrings--DefaultConnection/..." already exists...

Purge it manually:

```bash
az keyvault list-deleted --output table
az keyvault purge --name dotnetappazuredeploykv
```

### Diagnostic Settings conflict

If Terraform fails with:

> A resource with the ID "...apim-diagnostics..." already exists...

List and delete it:

```bash
az monitor diagnostic-settings list --resource ...
az monitor diagnostic-settings delete --name ...
```

Example:

```bash
az monitor diagnostic-settings list --resource "dotnetappazuredeploy-apim" --resource-group "dotnetappazuredeploy-rg" --resource-type "Microsoft.ApiManagement/service"

az monitor diagnostic-settings delete --name apim-monitor-diagnostics --resource "dotnetappazuredeploy-apim" --resource-group "dotnetappazuredeploy-rg" --resource-type "Microsoft.ApiManagement/service"
```

### Key Vault: “Soft Deleted” and Access Policy Issues

#### Problem:

- Azure Key Vault names are **globally unique**, not just within a subscription.
- If you delete a Key Vault and **soft delete** is enabled (default), the vault remains in a “soft deleted” state for 7 days.
- When Terraform tries to recreate a Key Vault with the same name, Azure **restores the old one** (including old Access Policies).

This can cause errors such as:

> `403 Forbidden: The client does not have secrets get permission on key vault`

This happens because **old Access Policies no longer match your current Service Principal** (used in `AZURE_CREDENTIALS` within GitHub Actions).  
If you recreated the Service Principal or changed its permissions, the restored Key Vault may still contain outdated access policies pointing to the old identity.

#### Solutions:

Purge the Old Key Vault (Recommended)

This option immediately removes the resource, allowing Terraform to create a new one with the correct settings.

1.  **List soft-deleted vaults:**

    ```bash
    az keyvault list-deleted
    ```

2.  **Permanently remove (purge) the old one:**

    ```bash
    az keyvault purge --name <key_vault_name> --location <location>
    ```

    Example:

    ```bash
    az keyvault purge --name dotnetappazuredeploykv --location westeurope
    ```

    Remember to replace `dotnetappazuredeploykv` and `westeurope` with your appropriate values.

> **Note:** This operation **requires sufficient permissions** in Azure (e.g., **Owner** or **User Access Administrator** role).

# Notes

- Resource names are examples; adapt them for your environment.
- The infrastructure is minimal and intended for demo/testing purposes.
- The sample passwords, logins, demo URLs are placeholders and should never be used in production. Use GitHub Secrets to store sensitive values.

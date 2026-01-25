variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "sql_admin_login" {
  description = "Login for SQL Server administrator"
  type        = string
  sensitive   = true
}

variable "sql_admin_password" {
  description = "Password for SQL Server administrator"
  type        = string
  sensitive   = true
}

variable "connection_string" {
  description = "Connection string to store in Key Vault"
  type        = string
  sensitive   = true
}
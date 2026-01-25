# terraform {
#   backend "azurerm" {
#     # Name of the resource group that contains the storage account
#     resource_group_name = "your-resource-group-name"
# 
#     # Name of the storage account (must be globally unique in Azure)
#     storage_account_name = "yourstorageaccountname"
# 
#     # Name of the container in the storage account to store the state file
#     container_name = "tfstate"
# 
#     # Key (i.e., file name) to use for the Terraform state file
#     key = "prod.terraform.tfstate"
#   }
# }

import { Component, OnInit } from "@angular/core";
import { CustomerService, Customer } from "./customer.service";

@Component({
  selector: "app-customer-list",
  template: `
    <ul>
      <li *ngFor="let customer of customers">
        {{ customer.id }}: {{ customer.name }}
      </li>
    </ul>
    <div *ngIf="error" style="color:red">{{ error }}</div>
  `,
})
export class CustomerListComponent implements OnInit {
  customers: Customer[] = [];
  error = "";
  constructor(private customerService: CustomerService) {}
  ngOnInit() {
    this.customerService.getCustomers().subscribe({
      next: (data) => (this.customers = data),
      error: (err) => (this.error = "Failed to load customers"),
    });
  }
}

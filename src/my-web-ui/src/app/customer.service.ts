import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../environments/environment";

export interface Customer {
  id: number;
  name: string;
}

@Injectable({ providedIn: "root" })
export class CustomerService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {}
  getCustomers(): Observable<Customer[]> {
    // environment.apiUrl resolves to '/api/customers' in production
    return this.http.get<Customer[]>(this.apiUrl);
  }
}

package com.tradeflow.api.customer;

import com.tradeflow.api.business.Business;
import com.tradeflow.api.business.BusinessRepository;
import com.tradeflow.api.user.UserAccount;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerService {
  private final BusinessRepository businesses;
  private final CustomerRepository customers;

  public CustomerService(BusinessRepository businesses, CustomerRepository customers) {
    this.businesses = businesses;
    this.customers = customers;
  }

  public List<CustomerResponse> list(UserAccount user) {
    Business business = businessFor(user);
    return customers.findByBusinessIdOrderByNameAsc(business.getId())
      .stream()
      .map(CustomerResponse::from)
      .toList();
  }

  @Transactional
  public CustomerResponse create(UserAccount user, CustomerRequest request) {
    Business business = businessFor(user);
    return CustomerResponse.from(customers.save(new Customer(business, request)));
  }

  @Transactional
  public CustomerResponse update(UserAccount user, UUID id, CustomerRequest request) {
    Business business = businessFor(user);
    Customer customer = customers.findByIdAndBusinessId(id, business.getId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
    customer.update(request);
    return CustomerResponse.from(customer);
  }

  @Transactional
  public void delete(UserAccount user, UUID id) {
    Business business = businessFor(user);
    Customer customer = customers.findByIdAndBusinessId(id, business.getId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
    customers.delete(customer);
  }

  private Business businessFor(UserAccount user) {
    return businesses.findByOwner(user)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business profile not found"));
  }
}

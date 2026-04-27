package com.tradeflow.api.customer;

import com.tradeflow.api.user.UserAccount;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
  private final CustomerService customers;

  public CustomerController(CustomerService customers) {
    this.customers = customers;
  }

  @GetMapping
  public List<CustomerResponse> list(@AuthenticationPrincipal UserAccount user) {
    return customers.list(user);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CustomerResponse create(
    @AuthenticationPrincipal UserAccount user,
    @Valid @RequestBody CustomerRequest request
  ) {
    return customers.create(user, request);
  }

  @PutMapping("/{id}")
  public CustomerResponse update(
    @AuthenticationPrincipal UserAccount user,
    @PathVariable UUID id,
    @Valid @RequestBody CustomerRequest request
  ) {
    return customers.update(user, id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@AuthenticationPrincipal UserAccount user, @PathVariable UUID id) {
    customers.delete(user, id);
  }
}

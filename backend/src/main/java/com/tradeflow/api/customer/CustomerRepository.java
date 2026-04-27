package com.tradeflow.api.customer;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
  List<Customer> findByBusinessIdOrderByNameAsc(UUID businessId);
  Optional<Customer> findByIdAndBusinessId(UUID id, UUID businessId);
}

package com.tradeflow.api.customer;

import com.tradeflow.api.business.Business;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "customers")
public class Customer {
  @Id
  @UuidGenerator
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "business_id", nullable = false)
  private Business business;

  @Column(nullable = false)
  private String name;

  private String email;
  private String phone;
  private String address;

  @Column(name = "whatsapp_phone")
  private String whatsappPhone;

  @Column(name = "whatsapp_opt_in", nullable = false)
  private boolean whatsappOptIn;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected Customer() {}

  public Customer(Business business, CustomerRequest request) {
    this.business = business;
    update(request);
  }

  public void update(CustomerRequest request) {
    this.name = request.name();
    this.email = request.email();
    this.phone = request.phone();
    this.address = request.address();
    this.whatsappPhone = request.whatsappPhone();
    this.whatsappOptIn = request.whatsappOptIn();
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getEmail() {
    return email;
  }

  public String getPhone() {
    return phone;
  }

  public String getWhatsappPhone() {
    return whatsappPhone;
  }

  public boolean isWhatsappOptIn() {
    return whatsappOptIn;
  }
}

package com.tradeflow.api.business;

import com.tradeflow.api.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "businesses")
public class Business {
  @Id
  @UuidGenerator
  private UUID id;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "owner_id", nullable = false)
  private UserAccount owner;

  @Column(nullable = false)
  private String name;

  private String email;
  private String phone;
  private String address;

  @Column(name = "billing_provider")
  private String billingProvider;

  @Column(name = "billing_customer_id")
  private String billingCustomerId;

  @Column(name = "billing_subscription_id")
  private String billingSubscriptionId;

  @Column(name = "billing_plan_id")
  private String billingPlanId;

  @Column(name = "subscription_status", nullable = false)
  private String subscriptionStatus = "trialing";

  @Column(name = "current_period_end")
  private Instant currentPeriodEnd;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected Business() {}

  public Business(UserAccount owner, String name, String email) {
    this.owner = owner;
    this.name = name;
    this.email = email;
  }

  public UUID getId() {
    return id;
  }

  public UserAccount getOwner() {
    return owner;
  }

  public String getName() {
    return name;
  }

  public String getSubscriptionStatus() {
    return subscriptionStatus;
  }

  public void activateBilling(String provider, String customerId, String subscriptionId, String planId, Instant periodEnd) {
    this.billingProvider = provider;
    this.billingCustomerId = customerId;
    this.billingSubscriptionId = subscriptionId;
    this.billingPlanId = planId;
    this.subscriptionStatus = "active";
    this.currentPeriodEnd = periodEnd;
  }

  public void markPastDue() {
    this.subscriptionStatus = "past_due";
  }
}

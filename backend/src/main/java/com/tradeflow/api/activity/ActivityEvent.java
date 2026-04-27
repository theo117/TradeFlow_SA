package com.tradeflow.api.activity;

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
@Table(name = "activity_events")
public class ActivityEvent {
  @Id
  @UuidGenerator
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "business_id", nullable = false)
  private Business business;

  @Column(nullable = false)
  private String type;

  @Column(nullable = false)
  private String description;

  private String channel;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected ActivityEvent() {}

  public ActivityEvent(Business business, String type, String description, String channel) {
    this.business = business;
    this.type = type;
    this.description = description;
    this.channel = channel;
  }
}

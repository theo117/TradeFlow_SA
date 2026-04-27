package com.tradeflow.api.business;

import com.tradeflow.api.user.UserAccount;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessRepository extends JpaRepository<Business, UUID> {
  Optional<Business> findByOwner(UserAccount owner);
  List<Business> findBySubscriptionStatusAndCurrentPeriodEndBefore(String status, Instant cutoff);
}

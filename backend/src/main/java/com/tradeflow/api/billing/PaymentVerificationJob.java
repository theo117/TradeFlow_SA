package com.tradeflow.api.billing;

import org.springframework.context.annotation.Conditional;

import com.tradeflow.api.business.Business;
import com.tradeflow.api.business.BusinessRepository;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Conditional(BillingEnabledCondition.class)
public class PaymentVerificationJob {
  private final BusinessRepository businesses;

  public PaymentVerificationJob(BusinessRepository businesses) {
    this.businesses = businesses;
  }

  @Scheduled(cron = "0 */15 * * * *")
  @Transactional
  public void markExpiredSubscriptionsPastDue() {
    for (Business business : businesses.findBySubscriptionStatusAndCurrentPeriodEndBefore("active", Instant.now())) {
      business.markPastDue();
    }
  }
}

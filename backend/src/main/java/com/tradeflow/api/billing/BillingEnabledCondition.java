package com.tradeflow.api.billing;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

// Match the frontend's explicit opt-in; missing or malformed flags stay disabled.
public class BillingEnabledCondition implements Condition {
  @Override
  public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
    return "on".equals(context.getEnvironment().getProperty("BILLING_ENFORCEMENT", "off"));
  }
}

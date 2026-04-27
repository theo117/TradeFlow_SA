package com.tradeflow.api.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tradeflow.payfast")
public record PayfastProperties(
  String passphrase,
  String validateUrl,
  String starterAmount,
  String proAmount
) {
  public String amountFor(String plan) {
    return switch (plan) {
      case "starter" -> starterAmount;
      case "pro" -> proAmount;
      default -> throw new IllegalArgumentException("Unsupported billing plan");
    };
  }
}

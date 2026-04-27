package com.tradeflow.api.customer;

import jakarta.validation.constraints.NotBlank;

public record CustomerRequest(
  @NotBlank String name,
  String email,
  String phone,
  String whatsappPhone,
  boolean whatsappOptIn,
  String address
) {}

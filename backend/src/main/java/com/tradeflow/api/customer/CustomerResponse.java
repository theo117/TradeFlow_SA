package com.tradeflow.api.customer;

public record CustomerResponse(
  String id,
  String name,
  String email,
  String phone,
  String whatsappPhone,
  boolean whatsappOptIn
) {
  static CustomerResponse from(Customer customer) {
    return new CustomerResponse(
      customer.getId().toString(),
      customer.getName(),
      customer.getEmail(),
      customer.getPhone(),
      customer.getWhatsappPhone(),
      customer.isWhatsappOptIn()
    );
  }
}

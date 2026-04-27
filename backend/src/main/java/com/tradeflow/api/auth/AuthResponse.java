package com.tradeflow.api.auth;

public record AuthResponse(String token, String userId, String businessId) {}

package com.tradeflow.api.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tradeflow.jwt")
public record JwtProperties(String secret, String issuer, long expirationMinutes) {}

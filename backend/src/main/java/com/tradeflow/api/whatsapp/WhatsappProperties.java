package com.tradeflow.api.whatsapp;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tradeflow.whatsapp")
public record WhatsappProperties(String verifyToken, String appSecret) {}

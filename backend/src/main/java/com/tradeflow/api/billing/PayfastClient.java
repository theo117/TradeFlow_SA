package com.tradeflow.api.billing;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class PayfastClient {
  private final PayfastProperties properties;
  private final WebClient webClient;

  public PayfastClient(PayfastProperties properties, WebClient webClient) {
    this.properties = properties;
    this.webClient = webClient;
  }

  public boolean validateNotification(String validationBody) {
    String response = webClient.post()
      .uri(properties.validateUrl())
      .contentType(MediaType.APPLICATION_FORM_URLENCODED)
      .body(BodyInserters.fromValue(validationBody))
      .retrieve()
      .bodyToMono(String.class)
      .map(String::trim)
      .map(String::toUpperCase)
      .block();

    return "VALID".equals(response);
  }
}

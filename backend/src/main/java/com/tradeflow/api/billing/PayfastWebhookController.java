package com.tradeflow.api.billing;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webhooks/payfast")
public class PayfastWebhookController {
  private final PayfastWebhookService payfast;

  public PayfastWebhookController(PayfastWebhookService payfast) {
    this.payfast = payfast;
  }

  @PostMapping(consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
  public WebhookAck notify(@RequestBody String body) {
    return payfast.handleNotification(body);
  }
}

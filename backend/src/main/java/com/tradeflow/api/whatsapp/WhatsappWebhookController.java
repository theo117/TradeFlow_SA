package com.tradeflow.api.whatsapp;

import com.tradeflow.api.billing.WebhookAck;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webhooks/whatsapp")
public class WhatsappWebhookController {
  private final WhatsappWebhookService whatsapp;

  public WhatsappWebhookController(WhatsappWebhookService whatsapp) {
    this.whatsapp = whatsapp;
  }

  @GetMapping
  public ResponseEntity<String> verify(
    @RequestParam("hub.mode") String mode,
    @RequestParam("hub.verify_token") String token,
    @RequestParam("hub.challenge") String challenge
  ) {
    return whatsapp.verify(mode, token)
      ? ResponseEntity.ok(challenge)
      : ResponseEntity.status(403).body("Invalid webhook verification request");
  }

  @PostMapping
  public WebhookAck receive(
    @RequestBody String body,
    @RequestHeader(value = "x-hub-signature-256", required = false) String signature
  ) {
    return whatsapp.handlePayload(body, signature);
  }
}

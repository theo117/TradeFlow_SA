package com.tradeflow.api.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradeflow.api.activity.ActivityEvent;
import com.tradeflow.api.activity.ActivityEventRepository;
import com.tradeflow.api.billing.WebhookAck;
import com.tradeflow.api.business.Business;
import com.tradeflow.api.business.BusinessRepository;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WhatsappWebhookService {
  private final ActivityEventRepository activityEvents;
  private final BusinessRepository businesses;
  private final ObjectMapper objectMapper;
  private final WhatsappProperties properties;

  public WhatsappWebhookService(
    ActivityEventRepository activityEvents,
    BusinessRepository businesses,
    ObjectMapper objectMapper,
    WhatsappProperties properties
  ) {
    this.activityEvents = activityEvents;
    this.businesses = businesses;
    this.objectMapper = objectMapper;
    this.properties = properties;
  }

  public boolean verify(String mode, String token) {
    return "subscribe".equals(mode) && properties.verifyToken() != null && properties.verifyToken().equals(token);
  }

  @Transactional
  public WebhookAck handlePayload(String body, String signature) {
    if (!signatureMatches(body, signature)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid WhatsApp signature");
    }

    try {
      JsonNode root = objectMapper.readTree(body);
      JsonNode entries = root.path("entry");
      if (entries.isArray()) {
        for (JsonNode entry : entries) {
          captureStatuses(entry);
        }
      }
      return new WebhookAck(true);
    } catch (Exception error) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid WhatsApp payload", error);
    }
  }

  private void captureStatuses(JsonNode entry) {
    for (JsonNode change : entry.path("changes")) {
      for (JsonNode status : change.path("value").path("statuses")) {
        String state = status.path("status").asText("updated");
        findBusinessFromCallback(status.path("biz_opaque_callback_data").asText(null)).ifPresent(business ->
          activityEvents.save(new ActivityEvent(
            business,
            "whatsapp.status",
            "WhatsApp delivery status changed to " + state + ".",
            "whatsapp"
          ))
        );
      }
    }
  }

  private Optional<Business> findBusinessFromCallback(String callbackData) {
    if (callbackData == null || callbackData.isBlank()) {
      return Optional.empty();
    }

    try {
      JsonNode callback = objectMapper.readTree(callbackData);
      String businessId = callback.path("businessId").asText(null);
      return businessId == null ? Optional.empty() : businesses.findById(UUID.fromString(businessId));
    } catch (Exception ignored) {
      return Optional.empty();
    }
  }

  private boolean signatureMatches(String body, String signature) {
    if (properties.appSecret() == null || properties.appSecret().isBlank()) {
      return false;
    }
    return signature != null && signature.equals("sha256=" + hmacSha256(body));
  }

  private String hmacSha256(String body) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(properties.appSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] digest = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte b : digest) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (Exception error) {
      throw new IllegalStateException("Unable to verify WhatsApp webhook", error);
    }
  }
}

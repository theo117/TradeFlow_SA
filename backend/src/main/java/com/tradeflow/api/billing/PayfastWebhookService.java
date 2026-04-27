package com.tradeflow.api.billing;

import com.tradeflow.api.business.Business;
import com.tradeflow.api.business.BusinessRepository;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PayfastWebhookService {
  private final BusinessRepository businesses;
  private final PayfastClient payfastClient;
  private final PayfastProperties properties;

  public PayfastWebhookService(
    BusinessRepository businesses,
    PayfastClient payfastClient,
    PayfastProperties properties
  ) {
    this.businesses = businesses;
    this.payfastClient = payfastClient;
    this.properties = properties;
  }

  @Transactional
  public WebhookAck handleNotification(String rawBody) {
    Map<String, String> params = parseForm(rawBody);
    String signature = params.get("signature");

    if (signature == null || !signature.equals(createSignature(params))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Payfast signature");
    }

    String validationBody = encodeForm(params.entrySet().stream()
      .filter(entry -> !"signature".equals(entry.getKey()))
      .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue)));

    if (!payfastClient.validateNotification(validationBody)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payfast validation failed");
    }

    String businessId = params.get("custom_str1");
    String plan = params.get("custom_str2");
    String paymentStatus = params.get("payment_status");

    if (businessId == null || plan == null || !"COMPLETE".equals(paymentStatus)) {
      return new WebhookAck(true);
    }

    if (!amountMatches(plan, params.get("amount_gross"))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment amount");
    }

    Business business = businesses.findById(UUID.fromString(businessId))
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found"));
    business.activateBilling(
      "payfast",
      params.get("email_address"),
      params.get("pf_payment_id"),
      plan,
      Instant.now().plus(30, ChronoUnit.DAYS)
    );

    return new WebhookAck(true);
  }

  private boolean amountMatches(String plan, String amount) {
    if (!"starter".equals(plan) && !"pro".equals(plan)) {
      return false;
    }
    return properties.amountFor(plan).equals(
      new BigDecimal(amount == null ? "0" : amount).setScale(2, RoundingMode.HALF_UP).toPlainString()
    );
  }

  private String createSignature(Map<String, String> params) {
    String payload = encodeForm(params.entrySet().stream()
      .filter(entry -> !"signature".equals(entry.getKey()))
      .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue)));
    return md5(payload + "&passphrase=" + urlEncode(properties.passphrase()));
  }

  private Map<String, String> parseForm(String body) {
    Map<String, String> values = new LinkedHashMap<>();
    for (String pair : body.split("&")) {
      String[] parts = pair.split("=", 2);
      if (parts.length == 2) {
        values.put(urlDecode(parts[0]), urlDecode(parts[1]));
      }
    }
    return values;
  }

  private String encodeForm(Map<String, String> values) {
    return values.entrySet().stream()
      .sorted(Comparator.comparing(Map.Entry::getKey))
      .map(entry -> entry.getKey() + "=" + urlEncode(entry.getValue()))
      .collect(Collectors.joining("&"));
  }

  private String urlDecode(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }

  private String urlEncode(String value) {
    return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8).replace("%20", "+");
  }

  private String md5(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("MD5");
      byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte b : hash) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (Exception error) {
      throw new IllegalStateException("Unable to create Payfast signature", error);
    }
  }
}

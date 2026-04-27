package com.tradeflow.api.security;

import com.tradeflow.api.user.UserAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

@Service
@EnableConfigurationProperties(JwtProperties.class)
public class JwtService {
  private final JwtProperties properties;
  private final SecretKey key;

  public JwtService(JwtProperties properties) {
    this.properties = properties;
    this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
  }

  public String createToken(UserAccount user) {
    Instant now = Instant.now();
    Instant expiresAt = now.plusSeconds(properties.expirationMinutes() * 60);

    return Jwts.builder()
      .issuer(properties.issuer())
      .subject(user.getEmail())
      .claim("userId", user.getId().toString())
      .issuedAt(Date.from(now))
      .expiration(Date.from(expiresAt))
      .signWith(key)
      .compact();
  }

  public Claims parseClaims(String token) {
    return Jwts.parser()
      .verifyWith(key)
      .requireIssuer(properties.issuer())
      .build()
      .parseSignedClaims(token)
      .getPayload();
  }

  public UUID getUserId(String token) {
    return UUID.fromString(parseClaims(token).get("userId", String.class));
  }
}

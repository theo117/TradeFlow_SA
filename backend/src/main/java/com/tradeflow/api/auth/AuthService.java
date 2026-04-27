package com.tradeflow.api.auth;

import com.tradeflow.api.business.Business;
import com.tradeflow.api.business.BusinessRepository;
import com.tradeflow.api.security.JwtService;
import com.tradeflow.api.user.UserAccount;
import com.tradeflow.api.user.UserAccountRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AuthService {
  private final AuthenticationManager authenticationManager;
  private final BusinessRepository businesses;
  private final JwtService jwtService;
  private final PasswordEncoder passwordEncoder;
  private final UserAccountRepository users;

  public AuthService(
    AuthenticationManager authenticationManager,
    BusinessRepository businesses,
    JwtService jwtService,
    PasswordEncoder passwordEncoder,
    UserAccountRepository users
  ) {
    this.authenticationManager = authenticationManager;
    this.businesses = businesses;
    this.jwtService = jwtService;
    this.passwordEncoder = passwordEncoder;
    this.users = users;
  }

  @Transactional
  public AuthResponse register(RegisterRequest request) {
    String email = request.email().toLowerCase();
    if (users.existsByEmail(email)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
    }

    UserAccount user = users.save(new UserAccount(email, passwordEncoder.encode(request.password())));
    Business business = businesses.save(new Business(user, request.businessName(), email));
    return new AuthResponse(jwtService.createToken(user), user.getId().toString(), business.getId().toString());
  }

  public AuthResponse login(LoginRequest request) {
    String email = request.email().toLowerCase();
    authenticationManager.authenticate(
      new UsernamePasswordAuthenticationToken(email, request.password())
    );

    UserAccount user = users.findByEmail(email)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
    Business business = businesses.findByOwner(user)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business profile not found"));
    return new AuthResponse(jwtService.createToken(user), user.getId().toString(), business.getId().toString());
  }
}

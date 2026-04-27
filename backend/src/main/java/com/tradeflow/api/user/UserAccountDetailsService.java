package com.tradeflow.api.user;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserAccountDetailsService implements UserDetailsService {
  private final UserAccountRepository users;

  public UserAccountDetailsService(UserAccountRepository users) {
    this.users = users;
  }

  @Override
  public UserDetails loadUserByUsername(String username) {
    return users.findByEmail(username.toLowerCase())
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));
  }
}

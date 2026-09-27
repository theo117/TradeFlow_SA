package com.tradeflow.api.billing;

import com.tradeflow.api.business.BusinessRepository;
import org.junit.jupiter.api.Test;
import java.util.Map;
import org.springframework.core.env.MapPropertySource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class DisabledBillingTest {
  @Test
  void disabledFlagsRegisterNeitherPublicWebhookNorScheduledJob() {
    for (String flag : new String[] { null, "off", "", "false", "true", "ON", "on " }) {
      BusinessRepository businesses = mock(BusinessRepository.class);
      PayfastWebhookService payfast = mock(PayfastWebhookService.class);
      ApplicationContextRunner runner = new ApplicationContextRunner()
        .withBean(BusinessRepository.class, () -> businesses)
        .withBean(PayfastWebhookService.class, () -> payfast)
        .withUserConfiguration(PayfastWebhookController.class, PaymentVerificationJob.class);
      if (flag != null) runner = runner.withInitializer(context -> context.getEnvironment().getPropertySources()
        .addFirst(new MapPropertySource("synthetic-billing-flag", Map.of("BILLING_ENFORCEMENT", flag))));
      runner.run(context -> {
        assertThat(context).hasNotFailed();
        assertThat(context).doesNotHaveBean(PayfastWebhookController.class);
        assertThat(context).doesNotHaveBean(PaymentVerificationJob.class);
        verifyNoInteractions(businesses, payfast);
      });
    }
  }

  @Test
  void codeRemainsAvailableOnlyWithExplicitEnablement() {
    BusinessRepository businesses = mock(BusinessRepository.class);
    PayfastWebhookService payfast = mock(PayfastWebhookService.class);
    new ApplicationContextRunner()
      .withPropertyValues("BILLING_ENFORCEMENT=on")
      .withBean(BusinessRepository.class, () -> businesses)
      .withBean(PayfastWebhookService.class, () -> payfast)
      .withUserConfiguration(PayfastWebhookController.class, PaymentVerificationJob.class)
      .run(context -> {
        assertThat(context).hasSingleBean(PayfastWebhookController.class);
        assertThat(context).hasSingleBean(PaymentVerificationJob.class);
        verifyNoInteractions(businesses, payfast);
      });
  }
}

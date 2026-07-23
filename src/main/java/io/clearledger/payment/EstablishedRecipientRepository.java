package io.clearledger.payment;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EstablishedRecipientRepository {
    private final JdbcTemplate jdbc;

    public EstablishedRecipientRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean exists(UUID senderId, UUID recipientId) {
        Integer result =
                jdbc.queryForObject(
                        "select count(*) from established_recipients where sender_id = ? and recipient_id = ?",
                        Integer.class,
                        senderId,
                        recipientId);
        return result != null && result > 0;
    }

    public void establishForDemo(UUID senderId, UUID recipientId) {
        jdbc.update(
                """
                insert into established_recipients(sender_id, recipient_id)
                values (?, ?)
                on conflict do nothing
                """,
                senderId,
                recipientId);
    }
}

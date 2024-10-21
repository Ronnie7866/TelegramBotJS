package com.example.teraboxbot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.methods.send.SendVideo;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
@EnableScheduling
public class TeraboxBotApplication {

    private static final String BOT_TOKEN = "7715788041:AAHivxUeO9se97Rm8RAHK5CcvKQyAcar8vY";
    private static final String BOT_USERNAME = "your_bot_username";

    public static void main(String[] args) {
        SpringApplication.run(TeraboxBotApplication.class, args);
    }

    @Bean
    public TelegramBotsApi telegramBotsApi() throws TelegramApiException {
        TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
        botsApi.registerBot(new TeraboxBot());
        return botsApi;
    }

    public class TeraboxBot extends TelegramLongPollingBot {

        private final Map<Long, String> uniqueUsers = new HashMap<>();
        private final Map<String, String> fileCache = new HashMap<>();

        @Override
        public String getBotUsername() {
            return BOT_USERNAME;
        }

        @Override
        public String getBotToken() {
            return BOT_TOKEN;
        }

        @Override
        public void onUpdateReceived(Update update) {
            if (update.hasMessage() && update.getMessage().hasText()) {
                String messageText = update.getMessage().getText();
                long chatId = update.getMessage().getChatId();
                String userName = getUserName(update);

                uniqueUsers.put(chatId, userName);

                if (isValidTeraboxLink(messageText)) {
                    processTeraboxLink(chatId, messageText, userName);
                } else {
                    sendTextMessage(chatId, "Please provide a valid Terabox link.");
                }
            }
        }

        private String getUserName(Update update) {
            String firstName = update.getMessage().getFrom().getFirstName();
            String lastName = update.getMessage().getFrom().getLastName();
            return (firstName + " " + lastName).trim();
        }

        private boolean isValidTeraboxLink(String url) {
            String[] teraboxDomains = {"terabox.com", "1024tera.com", "teraboxapp.com", "teraboxlink.com"};
            for (String domain : teraboxDomains) {
                if (url.contains(domain)) {
                    return true;
                }
            }
            return false;
        }

        private void processTeraboxLink(long chatId, String url, String userName) {
            try {
                int userCount = uniqueUsers.size();
                System.out.println("Request from: " + userName + " (ID: " + chatId + ") - Total Users: " + userCount);

                long processingMsgId = sendTextMessage(chatId, "Processing your link, please wait...");

                String fileId = getOrUploadVideo(chatId, url);
                deleteMessage(chatId, processingMsgId);

                sendVideo(chatId, fileId, "Here is your video!");

                System.out.println("SUCCESS - User: " + userName + " (ID: " + chatId + ") - Link: " + url);
            } catch (Exception e) {
                System.out.println("FAIL - User: " + userName + " (ID: " + chatId + "), URL: " + url + ", Error: " + e.getMessage());
                sendTextMessage(chatId, "Sorry, I couldn't process this link. Please try again later.");
            }
        }

        private String getOrUploadVideo(long chatId, String url) throws Exception {
            String videoId = getMd5(url);

            if (fileCache.containsKey(videoId)) {
                return fileCache.get(videoId);
            }

            TeraboxData data = getData(url);
            if (data == null) {
                throw new Exception("Could not process the link");
            }

            String fileName = data.getTitle() + ".mp4";
            Path tempFilePath = downloadVideo(data.getDirectLink(), fileName);
            String fileId = uploadToTelegram(chatId, tempFilePath, fileName, data.getThumb());

            fileCache.put(videoId, fileId);
            return fileId;
        }

        // Implement other methods like getData(), downloadVideo(), uploadToTelegram() here

        private long sendTextMessage(long chatId, String text) {
            SendMessage message = new SendMessage();
            message.setChatId(String.valueOf(chatId));
            message.setText(text);
            try {
                return execute(message).getMessageId();
            } catch (TelegramApiException e) {
                e.printStackTrace();
            }
            return 0;
        }

        private void sendVideo(long chatId, String fileId, String caption) {
            SendVideo sendVideo = new SendVideo();
            sendVideo.setChatId(String.valueOf(chatId));
            sendVideo.setVideo(fileId);
            sendVideo.setCaption(caption);
            try {
                execute(sendVideo);
            } catch (TelegramApiException e) {
                e.printStackTrace();
            }
        }

        private void deleteMessage(long chatId, long messageId) {
            // Implement delete message logic
        }

        private String getMd5(String input) {
            try {
                MessageDigest md = MessageDigest.getInstance("MD5");
                byte[] messageDigest = md.digest(input.getBytes());
                StringBuilder hexString = new StringBuilder();
                for (byte b : messageDigest) {
                    hexString.append(String.format("%02x", b));
                }
                return hexString.toString();
            } catch (NoSuchAlgorithmException e) {
                throw new RuntimeException(e);
            }
        }
    }

    // Add TeraboxData class and other necessary classes here
}

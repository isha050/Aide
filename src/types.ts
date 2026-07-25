export interface DraftedMessage {
    text: string;
    channel: string;
    format: "slack" | "discord";
}
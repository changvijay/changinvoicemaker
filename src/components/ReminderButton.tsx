import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { CompanySettings } from "@/types/invoice";
import { mailtoLink, whatsappLink } from "@/lib/renewals";

interface Props {
  email: string;
  phone: string;
  subject: string;
  /** Builds the message text once company details are loaded. */
  message: (company?: CompanySettings) => string;
  /** Called after the user opens or copies a reminder (e.g. to record "reminded on"). */
  onSent?: () => void;
  size?: "sm" | "icon";
}

/** Opens a pre-written reminder in the user's own email app or WhatsApp. Nothing is sent automatically. */
const ReminderButton = ({ email, phone, subject, message, onSent, size = "sm" }: Props) => {
  const { data: company } = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const text = message(company);
  const wa = phone ? whatsappLink(phone, text) : "";

  const open = (url: string) => {
    window.open(url, "_blank", "noopener");
    onSent?.();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reminder text copied");
      onSent?.();
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === "icon" ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Send reminder" title="Send reminder">
            <BellRing className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <BellRing className="h-3.5 w-3.5" /> Remind
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={!email} onClick={() => open(mailtoLink(email, subject, text))}>
          <Mail className="mr-2 h-4 w-4" /> {email ? "Email reminder" : "No email saved"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!wa} onClick={() => open(wa)}>
          <MessageCircle className="mr-2 h-4 w-4" /> {wa ? "WhatsApp reminder" : "No phone saved"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          <Copy className="mr-2 h-4 w-4" /> Copy message
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ReminderButton;

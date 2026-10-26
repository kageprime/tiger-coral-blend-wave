import { createFileRoute } from "@tanstack/react-router";
import { SmallPitch } from "@/game/SmallPitch";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SmallPitch />;
}

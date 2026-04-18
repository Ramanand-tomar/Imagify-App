import React from "react";

import { ServerStatusPill } from "@/components/ui";

interface Props {
  visible: boolean;
}

export const ServerStatusBanner: React.FC<Props> = ({ visible }) => {
  return <ServerStatusPill visible={visible} message="Server is waking up — first request can take up to 30s" />;
};

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  ACCESS_TOKEN_COMMANDS,
  ACCESS_TOKEN_REQUESTED_BY_CLI_STORAGE_KEY,
  ACCESS_TOKEN_REQUESTED_BY_CURSOR_STORAGE_KEY,
  CURSOR_PREFIX,
  TWO_MINS_IN_MS,
  VSCODE_PREFIX,
} from "@/constants";
import { useAuth, useUser } from "@clerk/nextjs";
import getAccessToken from "@studio/api/getAccessToken";
import { SEARCH_PARAMS_KEYS } from "@studio/store/getInitialState";
import { openIDELink } from "@studio/utils/openIDELink";

export const TokenBuilder = () => {
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    (async () => {
      const clerkToken = await getToken();
      if (clerkToken === null) {
        return;
      }
      const timestamp =
        ACCESS_TOKEN_COMMANDS.find((x) => localStorage.getItem(x)) ?? null;

      if (
        timestamp === null ||
        new Date().getTime() - Number.parseInt(timestamp, 10) > TWO_MINS_IN_MS
      ) {
        return;
      }

      if (localStorage.getItem(ACCESS_TOKEN_REQUESTED_BY_CLI_STORAGE_KEY)) {
        const [sessionId, iv] =
          localStorage
            .getItem(ACCESS_TOKEN_REQUESTED_BY_CLI_STORAGE_KEY)
            ?.split(",") || [];

        // Polling should pick it up
        await getAccessToken({
          clerkToken,
          sessionId,
          iv,
        });
      } else {
        await openIDELink(
          clerkToken,
          localStorage.getItem(ACCESS_TOKEN_REQUESTED_BY_CURSOR_STORAGE_KEY)
            ? CURSOR_PREFIX
            : VSCODE_PREFIX,
        );
      }
      ACCESS_TOKEN_COMMANDS.forEach((key) => localStorage.removeItem(key));
    })();
  }, [isSignedIn, isLoaded, getToken]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const command = searchParams.get(SEARCH_PARAMS_KEYS.COMMAND);

    if (
      command === null ||
      !ACCESS_TOKEN_COMMANDS.includes(command) ||
      !isLoaded
    ) {
      return;
    }

    if (isSignedIn) {
      (async () => {
        const clerkToken = await getToken();
        if (clerkToken === null) {
          return;
        }
        if (command === ACCESS_TOKEN_REQUESTED_BY_CLI_STORAGE_KEY) {
          const sessionId = searchParams.get(SEARCH_PARAMS_KEYS.SESSION_ID);
          const iv = searchParams.get(SEARCH_PARAMS_KEYS.IV);

          // Polling should pick it up
          await getAccessToken({
            clerkToken,
            sessionId,
            iv,
          });
          return;
        }

        await openIDELink(
          clerkToken,
          command === ACCESS_TOKEN_REQUESTED_BY_CURSOR_STORAGE_KEY
            ? CURSOR_PREFIX
            : VSCODE_PREFIX,
        );
      })();
      return;
    }

    if (command === ACCESS_TOKEN_REQUESTED_BY_CLI_STORAGE_KEY) {
      const sessionId = searchParams.get(SEARCH_PARAMS_KEYS.SESSION_ID);
      const iv = searchParams.get(SEARCH_PARAMS_KEYS.IV);

      localStorage.setItem(command, [sessionId, iv].join(","));
    } else {
      localStorage.setItem(command, new Date().getTime().toString());
    }

    router.push("/auth/sign-in");
  }, [getToken, isSignedIn, isLoaded, router]);

  return null;
};
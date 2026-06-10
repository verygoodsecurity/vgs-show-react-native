import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as React from "react";
import { CollectCardPage } from "./revealCardDemo/CollectCardPage";
import { ShowCardPage } from "./revealCardDemo/ShowCardPage";
import type { CardRevealPayload, DemoSession } from "./revealCardDemo/shared";

export {
  buildSession,
  DEMO_DEFAULT_VAULT_ID,
  REVEAL_CARD_DEMO_TITLE,
  type CardRevealPayload,
  type DemoSession
} from "./revealCardDemo/shared";

type CardTabsParamList = {
  Collect: undefined;
  Show: undefined;
};

const CardTabs = createBottomTabNavigator<CardTabsParamList>();

export function RevealCardDemoScreen(props: {
  readonly session: DemoSession;
  readonly onStoreRevealPayload: (payload: CardRevealPayload) => void;
}): React.ReactElement {
  return (
    <CardTabs.Navigator
      initialRouteName="Collect"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#9c5a1c",
        tabBarInactiveTintColor: "#6c7280",
        tabBarStyle: {
          backgroundColor: "#fffaf2",
          borderTopColor: "#dccfb8"
        }
      }}
    >
      <CardTabs.Screen
        name="Collect"
        options={{
          tabBarButtonTestID: "reveal-card-tab-collect",
          tabBarIconStyle: {
            transform: [{ rotate: "180deg" }]
          }
        }}
      >
        {() => (
          <CollectCardPage
            session={props.session}
            onStoreRevealPayload={props.onStoreRevealPayload}
          />
        )}
      </CardTabs.Screen>
      <CardTabs.Screen
        name="Show"
        options={{
          tabBarButtonTestID: "reveal-card-tab-show"
        }}
      >
        {() => <ShowCardPage session={props.session} />}
      </CardTabs.Screen>
    </CardTabs.Navigator>
  );
}

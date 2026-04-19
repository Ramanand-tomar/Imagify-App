import { forwardRef } from "react";
import { StyleSheet, TextInput as RNTextInput, View } from "react-native";
import { HelperText, TextInput, type TextInputProps } from "react-native-paper";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface InputProps extends Omit<TextInputProps, "theme" | "mode" | "error"> {
  label: string;
  errorText?: string | null;
  helper?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export const Input = forwardRef<RNTextInput, InputProps>(function Input(
  { label, errorText, helper, leftIcon, rightIcon, onRightIconPress, style, ...rest },
  ref,
) {
  const error = errorText;
  const theme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        mode="outlined"
        {...rest}
        dense={false}
        outlineStyle={{ borderRadius: theme.radius.md, borderWidth: 1 }}
        style={[
          {
            backgroundColor: theme.colors.surface.card,
            fontFamily: theme.fontFamily.regular,
          },
          style,
        ]}
        theme={{
          colors: {
            primary: theme.colors.brand.default,
            outline: error ? theme.colors.status.error : theme.colors.border.default,
            onSurface: theme.colors.text.primary,
            onSurfaceVariant: theme.colors.text.secondary,
            background: theme.colors.surface.card,
          },
          roundness: theme.radius.md,
        }}
        left={leftIcon ? <TextInput.Icon icon={leftIcon} color={theme.colors.text.secondary} /> : undefined}
        right={
          rightIcon
            ? (
              <TextInput.Icon
                icon={rightIcon}
                color={theme.colors.text.secondary}
                onPress={onRightIconPress}
              />
            )
            : undefined
        }
        error={Boolean(error)}
      />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : helper ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
});

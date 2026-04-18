import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { BottomSheet, Text, type SheetAction } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface FileUploaderProps {
  accept: "image" | "pdf" | "any";
  maxSizeBytes?: number;
  onFilePicked: (file: PickedFile) => void;
  label?: string;
  sublabel?: string;
}

const DEFAULT_MAX = 20 * 1024 * 1024;

export function FileUploader({
  accept,
  maxSizeBytes = DEFAULT_MAX,
  onFilePicked,
  label,
  sublabel,
}: FileUploaderProps) {
  const theme = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayLabel = label ?? (accept === "pdf" ? "Add a PDF" : accept === "image" ? "Add an image" : "Add a file");
  const displaySub =
    sublabel ??
    (accept === "pdf"
      ? "Tap to browse your files"
      : "Choose from camera, gallery, or files");

  const validate = (size: number, mime: string): string | null => {
    if (size > maxSizeBytes) return `File exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`;
    if (accept === "image" && !mime.startsWith("image/")) return "Only image files are allowed";
    if (accept === "pdf" && mime !== "application/pdf") return "Only PDF files are allowed";
    return null;
  };

  const pickDocument = async () => {
    setError(null);
    const mimeFilter = accept === "image" ? ["image/*"] : accept === "pdf" ? ["application/pdf"] : ["*/*"];
    const result = await DocumentPicker.getDocumentAsync({ type: mimeFilter, multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const size = asset.size ?? 0;
    const mime = asset.mimeType ?? "application/octet-stream";
    const err = validate(size, mime);
    if (err) return setError(err);
    onFilePicked({ uri: asset.uri, name: asset.name, mimeType: mime, size });
  };

  const pickFromGallery = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError("Permission to access photos denied");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const size = asset.fileSize ?? 0;
    const mime = asset.mimeType ?? "image/jpeg";
    const err = validate(size, mime);
    if (err) return setError(err);
    onFilePicked({
      uri: asset.uri,
      name: asset.fileName ?? `upload-${Date.now()}.jpg`,
      mimeType: mime,
      size,
    });
  };

  const pickFromCamera = async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission denied");
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const size = asset.fileSize ?? 0;
    const mime = asset.mimeType ?? "image/jpeg";
    const err = validate(size, mime);
    if (err) return setError(err);
    onFilePicked({
      uri: asset.uri,
      name: asset.fileName ?? `camera-${Date.now()}.jpg`,
      mimeType: mime,
      size,
    });
  };

  const openPicker = () => {
    if (accept === "pdf") {
      pickDocument();
      return;
    }
    setSheetOpen(true);
  };

  const actions: SheetAction[] = accept === "pdf"
    ? [{ key: "files", label: "Browse files", icon: "folder-outline", onPress: pickDocument }]
    : [
        { key: "camera", label: "Take a photo", description: "Use your camera", icon: "camera-outline", onPress: pickFromCamera },
        { key: "gallery", label: "Choose from gallery", description: "Recent photos", icon: "image-outline", onPress: pickFromGallery },
        { key: "files", label: "Browse files", description: "Pick from any app", icon: "folder-outline", onPress: pickDocument },
      ];

  return (
    <>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.dropzone,
          {
            borderColor: error ? theme.colors.status.error : theme.colors.border.default,
            backgroundColor: pressed ? theme.colors.brand[50] : theme.colors.surface.card,
            borderRadius: theme.radius.xl,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.brand[50] }]}>
          <Icon source="cloud-upload-outline" size={28} color={theme.colors.brand[700]} />
        </View>
        <Text variant="titleMd" align="center">
          {displayLabel}
        </Text>
        <Text variant="bodySm" tone="secondary" align="center">
          {displaySub}
        </Text>
        <Text variant="caption" tone="muted" align="center" style={{ marginTop: 4 }}>
          Max {Math.round(maxSizeBytes / 1024 / 1024)}MB
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" tone="error" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add file" actions={actions} />
    </>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
});

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface FileUploaderProps {
  /** Comma list of accepted mime types, e.g. "image/*" or "application/pdf" */
  accept: "image" | "pdf" | "any";
  /** Max size in bytes. Defaults to 20MB. */
  maxSizeBytes?: number;
  onFilePicked: (file: PickedFile) => void;
  label?: string;
}

const DEFAULT_MAX = 20 * 1024 * 1024;

export function FileUploader({
  accept,
  maxSizeBytes = DEFAULT_MAX,
  onFilePicked,
  label = "Choose file",
}: FileUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const validate = (size: number, mime: string): string | null => {
    if (size > maxSizeBytes) return `File exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`;
    if (accept === "image" && !mime.startsWith("image/")) return "Only image files are allowed";
    if (accept === "pdf" && mime !== "application/pdf") return "Only PDF files are allowed";
    return null;
  };

  const pickDocument = async () => {
    setError(null);
    const mimeFilter =
      accept === "image" ? ["image/*"] : accept === "pdf" ? ["application/pdf"] : ["*/*"];
    const result = await DocumentPicker.getDocumentAsync({ type: mimeFilter, multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const size = asset.size ?? 0;
    const mime = asset.mimeType ?? "application/octet-stream";
    const err = validate(size, mime);
    if (err) {
      setError(err);
      return;
    }
    onFilePicked({ uri: asset.uri, name: asset.name, mimeType: mime, size });
  };

  const pickFromGallery = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permission to access photos denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const size = asset.fileSize ?? 0;
    const mime = asset.mimeType ?? "image/jpeg";
    const err = validate(size, mime);
    if (err) {
      setError(err);
      return;
    }
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
    if (!perm.granted) {
      setError("Camera permission denied");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const size = asset.fileSize ?? 0;
    const mime = asset.mimeType ?? "image/jpeg";
    const err = validate(size, mime);
    if (err) {
      setError(err);
      return;
    }
    onFilePicked({
      uri: asset.uri,
      name: asset.fileName ?? `camera-${Date.now()}.jpg`,
      mimeType: mime,
      size,
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {accept !== "pdf" && (
          <>
            <Button mode="contained-tonal" icon="image" onPress={pickFromGallery} style={styles.btn}>
              Gallery
            </Button>
            <Button mode="contained-tonal" icon="camera" onPress={pickFromCamera} style={styles.btn}>
              Camera
            </Button>
          </>
        )}
        <Button mode="contained-tonal" icon="file" onPress={pickDocument} style={styles.btn}>
          Files
        </Button>
      </View>
      {error && <HelperText type="error" visible>{error}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  label: { textAlign: "center", color: "#374151" },
  row: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 8 },
  btn: { marginVertical: 4 },
});

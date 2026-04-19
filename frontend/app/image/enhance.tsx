import Slider from "@react-native-community/slider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { ResultViewer } from "@/components/ResultViewer";
import { TaskProgressCard } from "@/components/TaskProgressCard";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  ChipGroup,
  SectionHeader,
  Text,
} from "@/components/ui";
import { useImageSession, type EnhanceOp } from "@/hooks/useImageSession";
import { api } from "@/services/api";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";
import { extractErrorMessage } from "@/utils/errors";

type TabKey = EnhanceOp | "ai";
type AiMode = "super-res" | "lowlight" | "denoise-ai";

const OPS: { key: TabKey; label: string; icon: string; pro?: boolean }[] = [
  { key: "clahe", label: "Histogram", icon: "chart-histogram" },
  { key: "contrast", label: "Contrast", icon: "contrast" },
  { key: "sharpen", label: "Sharpen", icon: "image-filter-center-focus" },
  { key: "denoise", label: "Denoise", icon: "blur" },
  { key: "deblur", label: "Deblur", icon: "blur-off", pro: true },
  { key: "homomorphic", label: "Glow", icon: "sun-angle" },
  { key: "edges", label: "Edges", icon: "vector-square" },
  { key: "ai", label: "AI", icon: "auto-fix", pro: true },
];

interface Params {
  clahe: { clip_limit: number; tile_size: number };
  contrast: { contrast_pct: number; brightness: number };
  sharpen: { strength: number; radius: number };
  denoise: { filter_type: "median" | "gaussian" | "bilateral"; kernel_size: number };
  deblur: { blur_type: "motion" | "defocus"; kernel_size: number; noise_power: number };
  homomorphic: { gamma_low: number; gamma_high: number; cutoff: number };
  "denoise-ai": { h: number };
  edges: { operator: "sobel" | "prewitt" | "canny"; low_thresh: number; high_thresh: number };
}

const DEFAULTS: Params = {
  clahe: { clip_limit: 2.0, tile_size: 8 },
  contrast: { contrast_pct: 0, brightness: 0 },
  sharpen: { strength: 1.0, radius: 1.5 },
  denoise: { filter_type: "median", kernel_size: 3 },
  deblur: { blur_type: "motion", kernel_size: 15, noise_power: 0.01 },
  homomorphic: { gamma_low: 0.5, gamma_high: 2.0, cutoff: 30.0 },
  "denoise-ai": { h: 10 },
  edges: { operator: "canny", low_thresh: 100, high_thresh: 200 },
};

export default function EnhanceScreen() {
  const theme = useAppTheme();
  const session = useImageSession();
  const [tab, setTab] = useState<TabKey>("clahe");
  const [params, setParams] = useState<Params>(DEFAULTS);

  const [aiMode, setAiMode] = useState<AiMode>("super-res");
  const [srScale, setSrScale] = useState<2 | 3 | 4>(2);
  const [lowlightStrength, setLowlightStrength] = useState(1.0);
  const [aiTaskId, setAiTaskId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const aiCancelPoll = useRef<(() => void) | null>(null);

  const activeAiTask: Task | null = useTaskStore((s) => (aiTaskId ? s.active[aiTaskId] ?? null : null));

  useEffect(() => {
    if (!aiTaskId) return;
    if (!activeAiTask) return;
    let cancelled = false;

    if (activeAiTask.status === "success") {
      aiCancelPoll.current?.();
      aiCancelPoll.current = null;
      api
        .get<{ download_url: string; original_filename: string; mime_type: string; size_bytes: number }>(
          `/tasks/${aiTaskId}/result`,
        )
        .then(
          (r) => {
            if (!cancelled && r.data?.download_url) session.applyExternalResult(r.data);
          },
          (err) => {
            if (!cancelled) setAiError(extractErrorMessage(err, "Failed to fetch result"));
          },
        );
      setAiTaskId(null);
    } else if (activeAiTask.status === "failed") {
      aiCancelPoll.current?.();
      aiCancelPoll.current = null;
      setAiError(activeAiTask.error_message ?? "AI task failed");
      setAiTaskId(null);
    }

    return () => {
      cancelled = true;
    };
  }, [aiTaskId, activeAiTask, session]);

  useEffect(
    () => () => {
      aiCancelPoll.current?.();
      aiCancelPoll.current = null;
    },
    [],
  );

  const currentParams = useMemo(
    () => (tab === "ai" ? null : (params[tab as keyof Params] as Record<string, unknown>)),
    [params, tab],
  );

  useEffect(() => {
    if (session.sessionId && tab !== "ai" && currentParams) {
      session.requestPreview(tab as EnhanceOp, currentParams);
    }
  }, [session.sessionId, tab, currentParams, session]);

  const updateParam = useCallback(
    <K extends keyof Params>(which: K, patch: Partial<Params[K]>) => {
      setParams((prev) => ({ ...prev, [which]: { ...prev[which], ...patch } }));
    },
    [],
  );

  const onApply = async () => {
    if (tab === "ai" || !currentParams) return;
    if (tab === "deblur") {
      if (!session.sessionId) return;
      setAiError(null);
      try {
        const { data } = await api.post<{
          task_id?: string;
          download_url?: string;
          original_filename?: string;
          mime_type?: string;
          size_bytes?: number;
        }>("/image/enhance/deblur/session", {
          session_id: session.sessionId,
          operation: "deblur",
          params: currentParams,
        });
        if (data?.task_id) {
          setAiTaskId(data.task_id);
          aiCancelPoll.current = useTaskStore.getState().pollTask(data.task_id, 1500);
          return;
        }
        if (data?.download_url && data.original_filename && data.mime_type && typeof data.size_bytes === "number") {
          session.applyExternalResult({
            download_url: data.download_url,
            original_filename: data.original_filename,
            mime_type: data.mime_type,
            size_bytes: data.size_bytes,
          });
          return;
        }
        setAiError("Deblur returned an unexpected response");
      } catch (err: unknown) {
        setAiError(extractErrorMessage(err, "Deblur failed"));
      }
      return;
    }
    session.apply(tab as EnhanceOp, currentParams);
  };

  const onApplyAI = async () => {
    if (!session.sessionId) return;
    setAiError(null);
    setAiSubmitting(true);
    try {
      let endpoint = "/image/enhance/super-res/session";
      let aiParams: Record<string, unknown> = { scale: srScale };
      if (aiMode === "lowlight") {
        endpoint = "/image/enhance/lowlight/session";
        aiParams = { strength: lowlightStrength };
      } else if (aiMode === "denoise-ai") {
        endpoint = "/image/enhance/denoise-ai/session";
        aiParams = { h: params["denoise-ai"].h };
      }
      const { data } = await api.post<{ task_id: string }>(endpoint, {
        session_id: session.sessionId,
        operation: aiMode,
        params: aiParams,
      });
      if (!data?.task_id) throw new Error("Server did not return a task id");
      setAiTaskId(data.task_id);
      aiCancelPoll.current = useTaskStore.getState().pollTask(data.task_id, 1500);
    } catch (err: unknown) {
      setAiError(extractErrorMessage(err, "Failed to start AI task"));
    } finally {
      setAiSubmitting(false);
    }
  };

  const onReset = () => {
    setParams(DEFAULTS);
    setAiTaskId(null);
    setAiError(null);
    aiCancelPoll.current?.();
    session.reset();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface.background }]} edges={["bottom"]}>
      <AppHeader title="Enhance Image" subtitle="AI & classical image adjustments" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!session.originalUri ? (
          <FileUploader
            accept="image"
            onFilePicked={(f: PickedFile) => session.upload(f)}
            label={session.uploading ? "Uploading..." : "Pick an image to enhance"}
          />
        ) : (
          <>
            <Card padded={false} radius="xl" style={styles.previewCard}>
              <BeforeAfterSlider
                beforeUri={session.originalUri}
                afterUri={session.previewUri ?? session.originalUri}
                aspectRatio={session.width / Math.max(1, session.height)}
              />
              <View style={styles.statusRow}>
                {session.previewing ? <ActivityIndicator size="small" color={theme.colors.brand.default} /> : null}
                <Text variant="caption" tone="secondary">
                  {session.previewing ? "Generating preview..." : "Drag divider to compare"}
                </Text>
              </View>
            </Card>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
              {OPS.map((o) => {
                const active = tab === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setTab(o.key)}
                    style={[
                      styles.opTab,
                      {
                        backgroundColor: active ? theme.colors.brand.default : theme.colors.surface.card,
                        borderColor: active ? theme.colors.brand.default : theme.colors.border.default,
                        borderRadius: theme.radius.pill,
                      },
                    ]}
                  >
                    <Icon source={o.icon} size={14} color={active ? theme.colors.brand.contrast : theme.colors.text.secondary} />
                    <Text variant="titleSm" style={{ color: active ? theme.colors.brand.contrast : theme.colors.text.primary }}>
                      {o.label}
                    </Text>
                    {o.pro ? (
                      <View
                        style={[
                          styles.proDot,
                          { backgroundColor: active ? theme.onGradient.surfaceStrong : theme.colors.brand[50] },
                        ]}
                      >
                        <Text variant="caption" style={{ color: active ? theme.colors.brand.contrast : theme.colors.brand[700], fontSize: 9 }}>
                          PRO
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Card padded style={{ gap: 14 }}>
              <SectionHeader
                title={OPS.find((o) => o.key === tab)?.label ?? "Settings"}
                subtitle={tab === "ai" ? "Runs on server — progress shown below" : "Adjust and preview"}
              />
              {tab === "clahe" ? <ClaheControls value={params.clahe} onChange={(p) => updateParam("clahe", p)} /> : null}
              {tab === "contrast" ? <ContrastControls value={params.contrast} onChange={(p) => updateParam("contrast", p)} /> : null}
              {tab === "sharpen" ? <SharpenControls value={params.sharpen} onChange={(p) => updateParam("sharpen", p)} /> : null}
              {tab === "denoise" ? <DenoiseControls value={params.denoise} onChange={(p) => updateParam("denoise", p)} /> : null}
              {tab === "deblur" ? <DeblurControls value={params.deblur} onChange={(p) => updateParam("deblur", p)} /> : null}
              {tab === "homomorphic" ? <HomomorphicControls value={params.homomorphic} onChange={(p) => updateParam("homomorphic", p)} /> : null}
              {tab === "edges" ? <EdgeControls value={params.edges} onChange={(p) => updateParam("edges", p)} /> : null}
              {tab === "ai" ? (
                <AiControls
                  mode={aiMode}
                  onModeChange={setAiMode}
                  srScale={srScale}
                  onSrScale={setSrScale}
                  strength={lowlightStrength}
                  onStrength={setLowlightStrength}
                  denoiseH={params["denoise-ai"].h}
                  onDenoiseH={(h) => updateParam("denoise-ai", { h })}
                />
              ) : null}
            </Card>

            {activeAiTask && aiTaskId ? (
              <TaskProgressCard task={activeAiTask} title={aiMode === "super-res" ? "Super-resolution" : aiMode === "lowlight" ? "Low-light enhance" : "NLM Denoise"} />
            ) : null}

            {session.error || aiError ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.colors.status.errorSoft, borderRadius: theme.radius.md }]}>
                <Text variant="bodySm" tone="error">
                  {session.error ?? aiError}
                </Text>
              </View>
            ) : null}

            {session.result ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Saved" subtitle="Download or share the result" />
                <ResultViewer
                  filename={session.result.original_filename}
                  mimeType={session.result.mime_type}
                  sizeBytes={session.result.size_bytes}
                  downloadUrl={session.result.download_url}
                />
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button label="Reset" variant="secondary" onPress={onReset} disabled={session.applying || aiSubmitting} style={{ flex: 1 }} fullWidth />
              {tab === "ai" ? (
                <Button
                  label="Run AI"
                  icon="auto-fix"
                  onPress={onApplyAI}
                  loading={aiSubmitting || !!activeAiTask}
                  disabled={aiSubmitting || !!activeAiTask}
                  style={{ flex: 1 }}
                  fullWidth
                />
              ) : (
                <Button
                  label="Apply & Save"
                  onPress={onApply}
                  loading={session.applying}
                  disabled={session.applying}
                  style={{ flex: 1 }}
                  fullWidth
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayValue?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderLabelRow}>
        <Text variant="titleSm">{label}</Text>
        <Text variant="titleSm" tone="brand" style={{ fontVariant: ["tabular-nums"] }}>
          {displayValue ?? value.toFixed(2)}
        </Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={theme.colors.brand.default}
        maximumTrackTintColor={theme.colors.border.default}
        thumbTintColor={theme.colors.brand.default}
      />
    </View>
  );
}

function ClaheControls({ value, onChange }: { value: Params["clahe"]; onChange: (p: Partial<Params["clahe"]>) => void }) {
  return (
    <>
      <LabeledSlider label="Clip limit" min={0.5} max={10} step={0.1} value={value.clip_limit} onChange={(v) => onChange({ clip_limit: v })} />
      <LabeledSlider
        label="Tile size"
        min={2}
        max={16}
        step={1}
        value={value.tile_size}
        onChange={(v) => onChange({ tile_size: Math.round(v) })}
        displayValue={`${value.tile_size}×${value.tile_size}`}
      />
    </>
  );
}

function ContrastControls({ value, onChange }: { value: Params["contrast"]; onChange: (p: Partial<Params["contrast"]>) => void }) {
  return (
    <>
      <LabeledSlider
        label="Contrast"
        min={-100}
        max={100}
        step={1}
        value={value.contrast_pct}
        onChange={(v) => onChange({ contrast_pct: Math.round(v) })}
        displayValue={`${value.contrast_pct > 0 ? "+" : ""}${value.contrast_pct}`}
      />
      <LabeledSlider
        label="Brightness"
        min={-100}
        max={100}
        step={1}
        value={value.brightness}
        onChange={(v) => onChange({ brightness: Math.round(v) })}
        displayValue={`${value.brightness > 0 ? "+" : ""}${value.brightness}`}
      />
    </>
  );
}

function SharpenControls({ value, onChange }: { value: Params["sharpen"]; onChange: (p: Partial<Params["sharpen"]>) => void }) {
  return (
    <>
      <LabeledSlider label="Strength" min={0} max={3} step={0.1} value={value.strength} onChange={(v) => onChange({ strength: v })} />
      <LabeledSlider label="Radius" min={0.5} max={5} step={0.1} value={value.radius} onChange={(v) => onChange({ radius: v })} />
    </>
  );
}

function DenoiseControls({ value, onChange }: { value: Params["denoise"]; onChange: (p: Partial<Params["denoise"]>) => void }) {
  return (
    <>
      <Text variant="titleSm">Filter</Text>
      <ChipGroup
        value={value.filter_type}
        onChange={(v) => onChange({ filter_type: v as Params["denoise"]["filter_type"] })}
        options={[
          { value: "median", label: "Median" },
          { value: "gaussian", label: "Gaussian" },
          { value: "bilateral", label: "Bilateral" },
        ]}
      />
      <LabeledSlider
        label="Kernel size (odd)"
        min={3}
        max={15}
        step={2}
        value={value.kernel_size}
        onChange={(v) => onChange({ kernel_size: Math.round(v) })}
        displayValue={`${value.kernel_size}px`}
      />
    </>
  );
}

function EdgeControls({ value, onChange }: { value: Params["edges"]; onChange: (p: Partial<Params["edges"]>) => void }) {
  return (
    <>
      <Text variant="titleSm">Operator</Text>
      <ChipGroup
        value={value.operator}
        onChange={(v) => onChange({ operator: v as Params["edges"]["operator"] })}
        options={[
          { value: "canny", label: "Canny" },
          { value: "sobel", label: "Sobel" },
          { value: "prewitt", label: "Prewitt" },
        ]}
      />
      {value.operator === "canny" ? (
        <>
          <LabeledSlider label="Low threshold" min={0} max={500} step={5} value={value.low_thresh} onChange={(v) => onChange({ low_thresh: Math.round(v) })} />
          <LabeledSlider label="High threshold" min={0} max={500} step={5} value={value.high_thresh} onChange={(v) => onChange({ high_thresh: Math.round(v) })} />
        </>
      ) : null}
    </>
  );
}

function DeblurControls({ value, onChange }: { value: Params["deblur"]; onChange: (p: Partial<Params["deblur"]>) => void }) {
  return (
    <>
      <Text variant="titleSm">Blur model</Text>
      <ChipGroup
        value={value.blur_type}
        onChange={(v) => onChange({ blur_type: v as Params["deblur"]["blur_type"] })}
        options={[
          { value: "motion", label: "Motion" },
          { value: "defocus", label: "Defocus" },
        ]}
      />
      <LabeledSlider
        label="Kernel size"
        min={3}
        max={51}
        step={2}
        value={value.kernel_size}
        onChange={(v) => onChange({ kernel_size: Math.round(v) })}
        displayValue={`${value.kernel_size}px`}
      />
      <LabeledSlider
        label="Noise-to-Signal ratio"
        min={0.001}
        max={0.1}
        step={0.001}
        value={value.noise_power}
        onChange={(v) => onChange({ noise_power: v })}
      />
    </>
  );
}

function HomomorphicControls({ value, onChange }: { value: Params["homomorphic"]; onChange: (p: Partial<Params["homomorphic"]>) => void }) {
  return (
    <>
      <LabeledSlider label="Shadow boost (gamma low)" min={0.1} max={1.0} step={0.05} value={value.gamma_low} onChange={(v) => onChange({ gamma_low: v })} />
      <LabeledSlider label="Highlight suppression (gamma high)" min={1.0} max={4.0} step={0.1} value={value.gamma_high} onChange={(v) => onChange({ gamma_high: v })} />
      <LabeledSlider
        label="Cutoff frequency"
        min={1}
        max={100}
        step={1}
        value={value.cutoff}
        onChange={(v) => onChange({ cutoff: v })}
        displayValue={value.cutoff.toFixed(0)}
      />
    </>
  );
}

function AiControls({
  mode,
  onModeChange,
  srScale,
  onSrScale,
  strength,
  onStrength,
  denoiseH,
  onDenoiseH,
}: {
  mode: AiMode;
  onModeChange: (m: AiMode) => void;
  srScale: 2 | 3 | 4;
  onSrScale: (s: 2 | 3 | 4) => void;
  strength: number;
  onStrength: (s: number) => void;
  denoiseH: number;
  onDenoiseH: (h: number) => void;
}) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Badge label="AI" tone="violet" icon="auto-fix" />
        <Text variant="caption" tone="secondary">
          Server-side processing
        </Text>
      </View>
      <ChipGroup
        wrap
        value={mode}
        onChange={(v) => onModeChange(v as AiMode)}
        options={[
          { value: "super-res", label: "Upscale" },
          { value: "lowlight", label: "Lowlight" },
          { value: "denoise-ai", label: "NLM Denoise" },
        ]}
      />
      {mode === "super-res" ? (
        <ChipGroup
          value={String(srScale) as "2" | "3" | "4"}
          onChange={(v) => onSrScale(Number(v) as 2 | 3 | 4)}
          options={[
            { value: "2", label: "2×" },
            { value: "3", label: "3×" },
            { value: "4", label: "4×" },
          ]}
        />
      ) : null}
      {mode === "lowlight" ? (
        <LabeledSlider label="Enhancement strength" min={0} max={2} step={0.05} value={strength} onChange={onStrength} />
      ) : null}
      {mode === "denoise-ai" ? (
        <LabeledSlider label="Filter strength (h)" min={1} max={20} step={1} value={denoiseH} onChange={onDenoiseH} />
      ) : null}
      <Text variant="caption" tone="muted">
        Runs in the background. Result is saved to your task history.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 14 },
  previewCard: { overflow: "hidden" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  tabsRow: { gap: 8, paddingVertical: 4 },
  opTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  proDot: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 2 },
  sliderBlock: { gap: 4 },
  sliderLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  errorBanner: { padding: 12 },
});

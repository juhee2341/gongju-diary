/**
 * [D1] 일기 작성/수정
 * params: diaryId(필수), date(작성 모드 기본 날짜, 없으면 오늘), entryId(수정 모드)
 * TODO(8단계 #7) 함께 쓰기 첫 저장이면 알림 권한 요청
 */
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { SheetRow } from '@/components/SheetRow';
import { useToast } from '@/components/Toast';
import type { Emotion } from '@/constants/emotions';
import { DAILY_PROMPTS } from '@/constants/prompts';
import { DRAFT_INTERVAL_MS, ENTRY_MAX_CHARS, ENTRY_MIN_CHARS, MAX_PHOTOS, MIN_TOUCH } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { useDiary } from '@/features/diary/api';
import { leaveMissingDiary } from '@/features/diary/useMissingDiary';
import {
  newEntryId,
  removePhotoFiles,
  saveEntry,
  uploadPhotos,
  useEntry,
  useInvalidateEntries,
  useMyEntryDates,
  usePhotoUrls,
  type PhotoItem,
} from '@/features/entry/api';
import { DateSheet } from '@/features/entry/DateSheet';
import { EmotionPicker } from '@/features/entry/EmotionPicker';
import { PhotoSlots } from '@/features/entry/PhotoSlots';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useOnline } from '@/hooks/useOnline';
import { useToday } from '@/hooks/useToday';
import { confirm } from '@/lib/confirm';
import { formatListDate, isLate, promptIndexFor, writableRange } from '@/lib/date';
import { drafts } from '@/lib/device';
import { processEntryPhoto } from '@/lib/image';
import { AppError } from '@/lib/supabase';
import { clampGraphemes, graphemeLength, normalizeBody } from '@/lib/text';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Photo = PhotoItem & { key: string };
type Progress = { phase: 'upload'; done: number; total: number } | { phase: 'save' } | null;

export default function WriteEntry() {
  const params = useLocalSearchParams<{ diaryId: string; date?: string; entryId?: string }>();
  const diaryId = params.diaryId;
  const editId = params.entryId;
  const isEdit = !!editId;

  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const today = useToday();
  const userId = useMyUserId();
  const { diary } = useDiary(diaryId);
  const written = useMyEntryDates(diaryId, userId);
  const existing = useEntry(editId);
  const invalidate = useInvalidateEntries();

  const [entryId] = useState(() => editId ?? newEntryId());
  const [date, setDate] = useState(params.date ?? today);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [failed, setFailed] = useState<number[]>([]);
  const [promptRefresh, setPromptRefresh] = useState(0);
  const [dateOpen, setDateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);

  const remotePaths = photos.filter((p) => p.kind === 'remote').map((p) => (p as { path: string }).path);
  const remoteThumbs = usePhotoUrls(remotePaths, true);

  // 수정 모드: 기존 값 채우기
  useEffect(() => {
    if (!isEdit || initialized.current || !existing.data) return;
    initialized.current = true;
    const e = existing.data;
    setDate(e.entry_date);
    setEmotion(e.emotion);
    setContent(e.content);
    setPhotos(e.photo_paths.map((path) => ({ kind: 'remote', path, key: path })));
  }, [isEdit, existing.data]);

  // 작성 모드: 같은 일기장·같은 날짜 임시저장 복원 확인
  const checkDraft = useCallback(
    async (d: string) => {
      const draft = await drafts.get(diaryId, d);
      if (!draft) return;
      const resume = await new Promise<boolean>((resolve) =>
        Alert.alert(ko.write.draftTitle, undefined, [
          { text: ko.write.draftNew, onPress: () => resolve(false) },
          { text: ko.write.draftContinue, onPress: () => resolve(true) },
        ]),
      );
      if (!resume) return void drafts.remove(diaryId, d);
      setEmotion((draft.emotion as Emotion | null) ?? null);
      setContent(draft.content);
      setPhotos(draft.photos.map((p, i) => ({ kind: 'local', ...p, key: `draft-${i}-${p.thumb}` })));
      setDirty(true);
    },
    [diaryId],
  );
  useEffect(() => {
    if (isEdit || initialized.current) return;
    initialized.current = true;
    void checkDraft(date);
  }, [isEdit, checkDraft, date]);

  // DRAFT_INTERVAL마다 기기에 임시저장(작성 모드, 변경이 있을 때)
  const draftRef = useRef({ emotion, content, photos, date, dirty });
  draftRef.current = { emotion, content, photos, date, dirty };
  useEffect(() => {
    if (isEdit) return;
    const t = setInterval(() => {
      const s = draftRef.current;
      if (!s.dirty) return;
      void drafts.set(diaryId, s.date, {
        emotion: s.emotion,
        content: s.content,
        photos: s.photos.filter((p) => p.kind === 'local').map((p) => ({ full: (p as { full: string }).full, thumb: (p as { thumb: string }).thumb })),
        savedAt: new Date().toISOString(),
      });
    }, DRAFT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isEdit, diaryId]);

  const range = useMemo(
    () => (diary ? writableRange(diary.joined_date, today, diary.late_window_days) : { from: today, to: today }),
    [diary, today],
  );
  const writtenDates = (written.data ?? []).filter((w) => w.id !== editId).map((w) => w.entry_date);

  const bodyCount = graphemeLength(normalizeBody(content));
  const tooShort = photos.length === 0 && bodyCount > 0 && bodyCount < ENTRY_MIN_CHARS;
  const canSave = !!emotion && (photos.length > 0 || bodyCount >= ENTRY_MIN_CHARS) && !progress;
  const prompt = DAILY_PROMPTS[promptIndexFor(today, promptRefresh)];

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const onChangeContent = (t: string) => {
    const r = clampGraphemes(t, ENTRY_MAX_CHARS);
    setContent(r.value);
    setDirty(true);
    if (r.truncated) toast(fill(ko.common.maxChars, { N: ENTRY_MAX_CHARS }));
  };

  const addPicked = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const room = MAX_PHOTOS - photos.length;
    const processed: Photo[] = [];
    for (const a of assets.slice(0, room)) {
      const out = await processEntryPhoto({ uri: a.uri, width: a.width, height: a.height });
      processed.push({ kind: 'local', ...out, key: out.thumb });
    }
    setPhotos((p) => [...p, ...processed].slice(0, MAX_PHOTOS));
    setDirty(true);
  };

  const pickLibrary = async () => {
    setAddOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return toast(ko.write.photoPermissionDenied, { label: ko.common.openSettings, onPress: () => void Linking.openSettings() });
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) await addPicked(res.assets);
  };

  const takePhoto = async () => {
    setAddOpen(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return toast(ko.write.cameraPermissionDenied, { label: ko.common.openSettings, onPress: () => void Linking.openSettings() });
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (!res.canceled) await addPicked(res.assets);
  };

  const close = async () => {
    if (dirty && !(await confirm({ title: ko.common.discardTitle, ok: ko.common.discardLeave, destructive: true }))) return;
    if (!isEdit) void drafts.remove(diaryId, date);
    router.back();
  };

  const finish = async (savedId: string) => {
    await drafts.remove(diaryId, date);
    await invalidate(diaryId, savedId);
    // 수정은 원래 보던 D2로 돌아가고, 새 일기는 그 날짜의 C4로 간다
    if (isEdit) return router.back();
    router.dismiss();
    router.push({ pathname: '/home/diary/[id]/day/[date]', params: { id: diaryId, date, justSaved: '1' } });
  };

  const handleSaveError = async (e: unknown) => {
    const code = e instanceof AppError ? e.code : 'network';
    if (code === 'entry_exists') {
      const other = (written.data ?? []).find((w) => w.entry_date === date);
      Alert.alert(errorCopy.entry_exists, undefined, [
        { text: ko.write.existsClose, style: 'cancel' },
        ...(other
          ? [{ text: ko.write.existsEdit, onPress: () => router.replace({ pathname: '/entry/write', params: { diaryId, entryId: other.id } }) }]
          : []),
      ]);
      return;
    }
    if (code === 'not_member') {
      Alert.alert(ko.write.notMemberTitle, undefined, [
        { text: ko.common.close, style: 'cancel', onPress: () => leaveMissingDiary(toast) },
        {
          text: ko.write.copyText,
          onPress: async () => {
            await Clipboard.setStringAsync(content);
            toast(ko.write.copied);
          },
        },
      ]);
      return;
    }
    if (code === 'entry_not_found' && isEdit) {
      Alert.alert(errorCopy.entry_not_found, ko.write.deletedWriteNew, [
        { text: ko.common.cancel, style: 'cancel' },
        { text: ko.write.writeNew, onPress: () => router.replace({ pathname: '/entry/write', params: { diaryId, date } }) },
      ]);
      return;
    }
    // date_out_of_range, device_date_invalid, too_short, network…: 토스트, 임시저장 유지
    toast(errorCopy[code]);
  };

  const save = async (items: Photo[] = photos) => {
    if (!emotion) return;
    if (!online) return toast(ko.common.offline);
    setFailed([]);
    let paths: string[] = [];
    if (items.length) {
      setProgress({ phase: 'upload', done: 0, total: items.length });
      const up = await uploadPhotos(diaryId, entryId, items, (done) =>
        setProgress({ phase: 'upload', done, total: items.length }),
      );
      if (!up.ok) {
        setProgress(null);
        setFailed(up.failed);
        // 일기 저장은 모든 사진 업로드가 성공했을 때만(T16)
        Alert.alert(ko.write.uploadFailed, undefined, [
          { text: ko.write.saveWithout, onPress: () => {
            const kept = items.filter((_, i) => !up.failed.includes(i));
            setPhotos(kept);
            void save(kept);
          } },
          { text: ko.write.retryUpload, onPress: () => void save(items) },
        ]);
        return;
      }
      paths = up.paths;
    }
    setProgress({ phase: 'save' });
    try {
      const saved = await saveEntry({ id: entryId, diaryId, date, emotion, content, photoPaths: paths, deviceToday: today });
      // 수정 저장: 줄어든 슬롯의 사진 파일 정리
      const before = existing.data?.photo_paths ?? [];
      const dropped = before.filter((p) => !paths.includes(p));
      void removePhotoFiles(dropped).catch(() => undefined);
      setDirty(false);
      await finish(saved.id);
    } catch (e) {
      await handleSaveError(e);
    } finally {
      setProgress(null);
    }
  };

  const slotPhotos = photos.map((p) => ({
    key: p.key,
    preview: p.kind === 'local' ? p.thumb : (remoteThumbs.data?.[remotePaths.indexOf(p.path)] ?? null),
  }));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={ko.common.close} onPress={close} style={styles.barBtn}>
          <Text style={{ fontSize: fontSize.title, color: colors.text }}>✕</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isEdit}
          onPress={() => setDateOpen(true)}
          style={[styles.dateChip, { backgroundColor: colors.primarySoft, opacity: isEdit ? 0.7 : 1 }]}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {isEdit ? ko.write.editTitle + ' · ' : ''}
            {formatListDate(date, today)}
            {date === today ? ko.write.todaySuffix : ''}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={() => void save()}
          style={styles.barBtn}
        >
          <Text style={{ color: canSave ? colors.primary : colors.textSub, fontWeight: '800', fontSize: fontSize.body + 1 }}>
            {ko.write.save}
          </Text>
        </Pressable>
      </View>
      {isLate(date, today) && (
        <Text style={[styles.lateNotice, { color: colors.accent }]}>{ko.write.lateNotice}</Text>
      )}

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.section, { color: colors.text }]}>{ko.write.moodQuestion}</Text>
          <EmotionPicker value={emotion} onChange={change(setEmotion)} />

          <PhotoSlots
            photos={slotPhotos}
            failed={failed}
            onAdd={() => setAddOpen(true)}
            onRemove={(i) => {
              setPhotos((p) => p.filter((_, j) => j !== i));
              setFailed([]);
              setDirty(true);
            }}
            onMoveFirst={(i) => {
              if (i === 0) return;
              setPhotos((p) => [p[i]!, ...p.filter((_, j) => j !== i)]);
              setFailed([]);
              setDirty(true);
            }}
          />

          <View style={[styles.paper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.promptRow}>
              {/* 비어 있을 땐 질문이 입력창 안내 문구로 보이므로, 쓰기 시작한 뒤에만 위에 남긴다 */}
              <Text style={[styles.prompt, { color: colors.textSub }]} numberOfLines={2}>
                {content ? prompt : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ko.write.refreshPrompt}
                onPress={() => setPromptRefresh((n) => n + 1)}
                style={styles.refresh}
              >
                <Text style={{ fontSize: fontSize.title }}>🔄</Text>
              </Pressable>
            </View>
            <TextInput
              value={content}
              onChangeText={onChangeContent}
              placeholder={prompt}
              placeholderTextColor={colors.textSub}
              multiline
              textAlignVertical="top"
              accessibilityLabel={prompt}
              style={[styles.input, { color: colors.text }]}
            />
            <Text style={[styles.counter, { color: tooShort ? colors.danger : colors.textSub }]}>
              {fill(ko.write.counter, { N: bodyCount, MAX: ENTRY_MAX_CHARS })}
            </Text>
            {tooShort && <Text style={[styles.counter, { color: colors.danger }]}>{errorCopy.too_short}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DateSheet
        visible={dateOpen}
        from={range.from}
        to={range.to}
        today={today}
        selected={date}
        written={writtenDates}
        onSelect={(d) => {
          setDateOpen(false);
          if (d === date) return;
          setDate(d);
          void checkDraft(d);
        }}
        onClose={() => setDateOpen(false)}
      />

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title={ko.write.addPhoto}>
        <SheetRow label={ko.write.pickFromLibrary} onPress={() => void pickLibrary()} />
        <SheetRow label={ko.write.takePhoto} onPress={() => void takePhoto()} />
      </BottomSheet>

      {progress && (
        <View style={styles.overlay} accessibilityLiveRegion="polite">
          <View style={[styles.overlayBox, { backgroundColor: colors.surface }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.text }}>
              {progress.phase === 'upload'
                ? fill(ko.write.uploading, { N: progress.done, TOTAL: progress.total })
                : ko.write.saving}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.sm },
  barBtn: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  dateChip: { flex: 1, minHeight: MIN_TOUCH - spacing.sm, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  lateNotice: { textAlign: 'center', fontSize: fontSize.caption, fontWeight: '700' },
  content: { padding: spacing.xl, gap: spacing.xl },
  section: { fontSize: fontSize.body + 1, fontWeight: '800' },
  paper: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, gap: spacing.sm, minHeight: 240 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prompt: { flex: 1, fontSize: fontSize.caption, fontWeight: '600' },
  refresh: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 160, fontSize: fontSize.body + 1, lineHeight: 26 },
  counter: { alignSelf: 'flex-end', fontSize: fontSize.caption },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  overlayBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.card },
});

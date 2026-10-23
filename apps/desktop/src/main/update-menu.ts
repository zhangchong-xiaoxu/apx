// The update as the app menu says it ("Check for updates…", "Update to APX 2.3.0…", "Restart to update to APX 2.3.0")
// and the native questions it asks when the owner started it there: restart now or later.
import { type BaseWindow, dialog, type MenuItemConstructorOptions, Notification } from "electron";
import type { Lang } from "./lang.ts";
import type { createDesktopUpdater, DesktopUpdate } from "./updater.ts";

type Updater = ReturnType<typeof createDesktopUpdater>;

const words = (lang: Lang, platform: string) => {
  const pick = (en: string, es: string, zh: string) => ({ en, es, zh })[lang];
  return {
    check: pick("Check for updates…", "Buscar actualizaciones…", "检查更新…"),
    update: (v: string) => pick(`Update to APX ${v}…`, `Actualizar a APX ${v}…`, `更新到 APX ${v}…`),
    downloading: (v: string) => pick(`Downloading APX ${v}…`, `Descargando APX ${v}…`, `正在下载 APX ${v}…`),
    restart: (v: string) =>
      pick(`Restart to update to APX ${v}`, `Reiniciar para actualizar a APX ${v}`, `重启以更新到 APX ${v}`),
    readyTitle: (v: string) => pick(`APX ${v} is ready`, `APX ${v} está listo`, `APX ${v} 已就绪`),
    readyDetail:
      platform === "win32"
        ? pick(
            "It goes in when APX restarts. If you choose later, it waits in the APX menu: Restart to update.",
            "Se instala al reiniciar APX. Si elegís más tarde, queda en el menú APX: Reiniciar para actualizar.",
            "重启 APX 时会安装。如果选择稍后，它会留在 APX 菜单中：重启以更新。",
          )
        : pick(
            "It goes in when APX restarts. If you choose later, it goes in when you quit APX.",
            "Se instala al reiniciar APX. Si elegís más tarde, se instala cuando salgas de APX.",
            "重启 APX 时会安装。如果选择稍后，它会在你退出 APX 时安装。",
          ),
    restartNow: pick("Restart now", "Reiniciar ahora", "立即重启"),
    later: pick("Later", "Más tarde", "稍后"),
    upToDate: pick("APX is up to date", "APX está al día", "APX 已是最新版本"),
    version: (v: string) => pick(`You have version ${v}.`, `Tenés la versión ${v}.`, `你当前使用的是 ${v} 版。`),
    failed: pick("APX could not update", "No se pudo actualizar APX", "APX 更新失败"),
    noFeed: pick(
      "Could not ask whether a newer version is out.",
      "No se pudo consultar si hay una versión nueva.",
      "无法查询是否有新版本。",
    ),
    dragged: (v: string) =>
      pick(
        `APX ${v} opened: drag it into Applications, replacing this one, and open it again.`,
        `Se abrió APX ${v}: arrastralo a Aplicaciones, reemplazando este, y abrilo de nuevo.`,
        `已打开 APX ${v}：请把它拖到“应用程序”中替换当前版本，然后重新打开。`,
      ),
    readyNote: (v: string) =>
      pick(
        `APX ${v} is ready. Restart APX to use it.`,
        `APX ${v} está listo. Reiniciá APX para usarlo.`,
        `APX ${v} 已就绪。重启 APX 即可使用。`,
      ),
    outNote: (v: string) =>
      pick(
        `APX ${v} is out. Open APX to update.`,
        `Salió APX ${v}. Abrí APX para actualizar.`,
        `APX ${v} 已发布。打开 APX 即可更新。`,
      ),
    ok: pick("OK", "Aceptar", "确定"),
  };
};

export function createUpdateMenu(opts: { updater: Updater; window: BaseWindow; lang: Lang; platform: string }) {
  const { updater, window } = opts;
  const t = words(opts.lang, opts.platform);
  let told: string | undefined;

  async function askRestart(version: string): Promise<void> {
    const { response } = await dialog.showMessageBox(window, {
      type: "info",
      message: t.readyTitle(version),
      detail: t.readyDetail,
      buttons: [t.restartNow, t.later],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) updater.restart();
  }

  async function update(version: string): Promise<void> {
    const r = await updater.install();
    if (!r.ok) {
      await dialog.showMessageBox(window, { type: "warning", message: t.failed, detail: r.error, buttons: [t.ok] });
      return;
    }
    if (r.ready) await askRestart(version);
    else await dialog.showMessageBox(window, { type: "info", message: t.dragged(version), buttons: [t.ok] });
  }

  async function checkNow(): Promise<void> {
    const s = await updater.check();
    if (s.latest) return update(s.latest);
    await dialog.showMessageBox(window, {
      type: s.error ? "warning" : "info",
      message: s.error ? t.failed : t.upToDate,
      detail: s.error ? `${t.noFeed}\n${s.error}` : t.version(s.current),
      buttons: [t.ok],
    });
  }

  return {
    /** The app menu's update entry, as things stand now; none where the app does not update itself (a checkout). */
    item(s: DesktopUpdate): MenuItemConstructorOptions | undefined {
      if (!updater.enabled) return undefined;
      if (s.ready) return { id: "update", label: t.restart(s.ready), click: () => updater.restart() };
      if (s.downloading && s.latest) return { id: "update", label: t.downloading(s.latest), enabled: false };
      const latest = s.latest;
      if (latest) return { id: "update", label: t.update(latest), click: () => void update(latest) };
      return { id: "update", label: t.check, click: () => void checkNow() };
    },
    /** A background check found a newer APX: auto mode downloads it and says once it is ready; drag mode says it is out. */
    found(s: DesktopUpdate) {
      const latest = s.latest;
      if (!latest || told === latest) return;
      told = latest;
      const notify = (body: string, click?: () => void) => {
        if (!Notification.isSupported()) return;
        const n = new Notification({ title: "APX", body });
        if (click) n.on("click", click);
        n.show();
      };
      if (updater.mode !== "auto") return notify(t.outNote(latest));
      void updater.install().then((r) => {
        if (r.ok && r.ready) notify(t.readyNote(latest), () => void askRestart(latest));
      });
    },
  };
}

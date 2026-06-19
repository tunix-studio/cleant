# Disclaimer

tclean is a disk‑cleaning utility that **removes files** from your Mac. Please read
this before using it.

## No warranty

tclean is provided **“AS IS”, without warranty of any kind**, express or implied,
including but not limited to the warranties of merchantability, fitness for a
particular purpose and non‑infringement. See the [LICENSE](LICENSE) (Apache‑2.0,
Sections 7 and 8) for the full Disclaimer of Warranty and Limitation of Liability.

## Your responsibility

- **You decide what is removed.** tclean shows you what it found and asks for
  confirmation; you choose what to clear.
- **Data loss is possible.** No automated cleaner can know with certainty which
  files you still need. Review selections, especially anything marked “review”.
- **Keep backups.** Maintain a current backup (e.g. Time Machine) before clearing
  large amounts of data.
- To the maximum extent permitted by law, **Tunix Studio and contributors are not
  liable** for any data loss or damage resulting from the use of this software.

## How tclean reduces risk

- Moves items to the **Trash by default** (reversible); permanent deletion is opt‑in.
- **Confirms** before removing anything.
- Operates only within your home folder (and `/Applications` for uninstall), on
  validated locations, never following symlinks and never touching `/System`.
- Lets you define **exclusion rules** for paths that must never be touched.

By using tclean you acknowledge that you have read and understood this disclaimer.

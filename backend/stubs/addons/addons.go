// Package addons is the stub aggregation point used by OSS builds, where the
// module replace in go.mod points here instead of ./addon. It registers
// nothing: with no build-tagged files, blank-importing it (even with an addon
// tag set) is a no-op. The real ./addon module provides the actual addons.
package addons

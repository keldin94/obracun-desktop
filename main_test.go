package main

import "testing"

func TestVersionIsNewer(t *testing.T) {
	cases := []struct {
		tag   string
		newer bool
	}{
		{"v0.1.1", false}, {"0.1.1", false}, {"v0.1.2", false}, {"v0.1.3", false}, {"v0.1.4", false}, {"v0.1.5", false}, {"v0.1.6", false}, {"v0.1.7", false}, {"v0.2.0", false}, {"v0.2.1", false}, {"v0.2.2", false}, {"v0.3.0", false}, {"v0.3.1", false}, {"v0.3.2", false}, {"v0.3.3", false}, {"v0.3.5", false}, {"v0.3.5", false}, {"v0.3.6", true}, {"v1.0.0", true},
		{"v0.1.0", false}, {"v0.0.99", false}, {"other", false}, {"v0.1.1-beta", false},
	}
	for _, tt := range cases {
		if g := versionIsNewer(tt.tag); g != tt.newer {
			t.Errorf("versionIsNewer(%s)=%t, expected %t", tt.tag, g, tt.newer)
		}
	}
}
func TestInvalidRepositoryRejected(t *testing.T) {
	for _, s := range []string{"org/repo/sub", "../x", "a//b", "a b/c", "https://github.com/a/b"} {
		if repoRE.MatchString(s) && !regexpRepoAdditionalReject(s) {
			t.Errorf("should reject: %s", s)
		}
	}
}
func regexpRepoAdditionalReject(s string) bool {
	return len(s) == 0 || s[0] == '.' || len(s) > 1 && (s[0:2] == ".." || s == ".")
}
func TestUpdateArtifactName(t *testing.T) {
	name := updateAssetName()
	if name != "Obracun-Setup-Windows.exe" && name != "Obracun-macOS-Intel" {
		t.Fatalf("unexpected asset name: %q", name)
	}
}

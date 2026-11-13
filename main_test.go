package main
import "testing"
func TestVersions(t *testing.T){
 for _,tt:=range []struct{version string;expected bool}{
  {"v0.1.1",false},{"v0.1.2",true},{"v0.2.0",true},{"v1.0.0",true},{"v0.1.0",false},{"test",false},
 }{if newer(tt.version)!=tt.expected{t.Errorf("newer(%q)",tt.version)}}
}
func TestRepos(t *testing.T){
 for _,s:=range []string{"../a","a//b","a/b/c","a b/x","https://github.com/a/b"}{
  if validRepo(s){t.Errorf("should reject %q",s)}
 }
 if !validRepo("keldin94/obracun-desktop"){t.Error("valid repository rejected")}
}

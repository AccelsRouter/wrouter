package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIPFromViewerAddress(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"ipv4 with port", "203.0.113.5:1234", "203.0.113.5"},
		{"ipv6 with port", "2001:db8::1:1234", "2001:db8::1"},
		{"ipv6 loopback with port", "::1:5678", "::1"},
		{"ipv6 full with port", "2001:db8:0:0:0:0:0:1:443", "2001:db8:0:0:0:0:0:1"},
		{"bare ipv4 no port", "203.0.113.5", "203.0.113.5"},
		{"bare ipv6 no port", "2001:db8::1", "2001:db8::1"},
		{"empty", "", ""},
		{"garbage", "not-an-ip:1234", ""},
		{"port only", ":1234", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ipFromViewerAddress(tc.in))
		})
	}
}

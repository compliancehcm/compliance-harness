{{- define "compliance-ai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "compliance-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "compliance-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "compliance-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "compliance-ai.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "compliance-ai.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* The image reference: a digest pins it and wins over any tag. */}}
{{- define "compliance-ai.image" -}}
{{- if .Values.image.digest }}
{{- printf "%s@%s" .Values.image.repository .Values.image.digest }}
{{- else }}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) }}
{{- end }}
{{- end }}

{{/*
The origin browsers use. Derived from the ingress host when not given, because
the OAuth redirect URI is built from it and a wrong value only surfaces as a
provider error at the first login.
*/}}
{{- define "compliance-ai.publicUrl" -}}
{{- if .Values.sso.publicUrl }}
{{- .Values.sso.publicUrl | trimSuffix "/" }}
{{- else if and .Values.ingress.enabled .Values.ingress.host }}
{{- printf "%s://%s" (ternary "https" "http" .Values.ingress.tls.enabled) .Values.ingress.host }}
{{- else }}
{{- fail "sso.publicUrl is required when the ingress is disabled: it is the origin browsers use, and <publicUrl>/auth/callback must be registered on the OIDC client" }}
{{- end }}
{{- end }}

{{/* The Secret whose keys become environment variables, or empty for none. */}}
{{- define "compliance-ai.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else if .Values.secrets.values }}
{{- include "compliance-ai.fullname" . }}
{{- end }}
{{- end }}

{{- define "compliance-ai.appArmorField" -}}
{{- $mode := .Values.confinement.appArmor }}
{{- if not (has $mode (list "auto" "field" "annotation" "none")) }}
{{- fail (printf "confinement.appArmor must be auto, field, annotation or none; got %q" $mode) }}
{{- end }}
{{- if eq $mode "auto" }}
{{- ternary "field" "annotation" (semverCompare ">=1.30.0-0" .Capabilities.KubeVersion.Version) }}
{{- else }}
{{- $mode }}
{{- end }}
{{- end }}

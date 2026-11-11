param environmentId string
param image string
param corsOrigin string
param location string = resourceGroup().location

resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'xgif-to-wasticker-api'
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          env: [
            {
              name: 'CORS_ORIGIN'
              value: corsOrigin
            }
            {
              name: 'CONVERSION_CONCURRENCY'
              value: '1'
            }
          ]
          resources: {
            cpu: 1
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output apiUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
